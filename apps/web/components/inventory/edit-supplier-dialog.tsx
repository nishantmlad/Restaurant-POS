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
import { useUpdateSupplier, type Supplier } from "@/hooks/use-inventory";
import { ApiError } from "@/lib/api";

export function EditSupplierDialog({
  branchId,
  supplier,
  onClose,
}: {
  branchId: string | null;
  supplier: Supplier;
  onClose: () => void;
}) {
  const [name, setName] = useState(supplier.name);
  const [contactName, setContactName] = useState(supplier.contactName ?? "");
  const [phone, setPhone] = useState(supplier.phone ?? "");
  const [email, setEmail] = useState(supplier.email ?? "");
  const [gstNumber, setGstNumber] = useState(supplier.gstNumber ?? "");
  const [address, setAddress] = useState(supplier.address ?? "");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const updateSupplier = useUpdateSupplier(branchId);

  const validate = () => {
    const errs: typeof errors = {};
    if (!name.trim()) {
      errs.name = "Business name is required";
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address";
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

    updateSupplier.mutate(
      {
        id: supplier.id,
        dto: {
          name: name.trim(),
          contactName: contactName.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          gstNumber: gstNumber.trim() || undefined,
          address: address.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(`${name.trim()} updated`);
          onClose();
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Could not update supplier"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Edit supplier</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-s-name">Business name</Label>
            <Input
              id="edit-s-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              aria-invalid={Boolean(errors.name)}
              autoFocus
              required
            />
            {errors.name && <p className="text-xs font-medium text-destructive">{errors.name}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-s-contact">Contact person</Label>
            <Input
              id="edit-s-contact"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. Ramesh Shah"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-s-phone">Phone</Label>
              <Input
                id="edit-s-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98251 23456"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-s-email">Email</Label>
              <Input
                id="edit-s-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                aria-invalid={Boolean(errors.email)}
                placeholder="orders@supplier.in"
              />
              {errors.email && <p className="text-xs font-medium text-destructive">{errors.email}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-s-gst">GSTIN (Optional)</Label>
            <Input
              id="edit-s-gst"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              placeholder="e.g. 24ABCDE1234F1Z5"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-s-address">Address (Optional)</Label>
            <Input
              id="edit-s-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Ring Road, Surat"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateSupplier.isPending}>
              {updateSupplier.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

