"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOpsActions, type EquipmentRow } from "@/hooks/use-marketing";
import { ApiError } from "@/lib/api";

export function EditEquipmentDialog({
  branchId,
  item,
  onClose,
}: {
  branchId: string | null;
  item: EquipmentRow;
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [location, setLocation] = useState(item.location ?? "");
  const [serviceIntervalDays, setServiceIntervalDays] = useState(
    item.serviceIntervalDays ? String(item.serviceIntervalDays) : "",
  );
  const [lastServicedAt, setLastServicedAt] = useState(
    item.lastServicedAt ? item.lastServicedAt.slice(0, 10) : "",
  );
  const [errors, setErrors] = useState<{ name?: string; serviceIntervalDays?: string }>({});

  const { updateEquipment } = useOpsActions(branchId);

  const validate = () => {
    const errs: typeof errors = {};
    if (!name.trim()) {
      errs.name = "Equipment name is required";
    }
    if (
      serviceIntervalDays.trim() &&
      (isNaN(Number(serviceIntervalDays)) || Number(serviceIntervalDays) <= 0)
    ) {
      errs.serviceIntervalDays = "Enter a positive number of days";
    }
    return errs;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error(Object.values(validationErrors)[0]);
      return;
    }
    setErrors({});
    updateEquipment.mutate(
      {
        id: item.id,
        dto: {
          name: name.trim(),
          location: location.trim() || undefined,
          serviceIntervalDays: serviceIntervalDays.trim()
            ? Number(serviceIntervalDays)
            : undefined,
          lastServicedAt: lastServicedAt || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Equipment updated");
          onClose();
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Could not update equipment"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Edit equipment</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-eq-name">Equipment name *</Label>
            <Input
              id="edit-eq-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              aria-invalid={Boolean(errors.name)}
              autoFocus
            />
            {errors.name && <p className="text-xs font-medium text-destructive">{errors.name}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-eq-location">Location (optional)</Label>
            <Input
              id="edit-eq-location"
              placeholder="e.g. Hot Kitchen / Station 1"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-eq-interval">Service interval (days)</Label>
              <Input
                id="edit-eq-interval"
                inputMode="numeric"
                placeholder="e.g. 90"
                value={serviceIntervalDays}
                onChange={(e) => {
                  setServiceIntervalDays(e.target.value);
                  if (errors.serviceIntervalDays)
                    setErrors((prev) => ({ ...prev, serviceIntervalDays: undefined }));
                }}
                aria-invalid={Boolean(errors.serviceIntervalDays)}
              />
              {errors.serviceIntervalDays && (
                <p className="text-xs font-medium text-destructive">{errors.serviceIntervalDays}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-eq-last-serviced">Last serviced</Label>
              <Input
                id="edit-eq-last-serviced"
                type="date"
                value={lastServicedAt}
                onChange={(e) => setLastServicedAt(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateEquipment.isPending}>
              {updateEquipment.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

