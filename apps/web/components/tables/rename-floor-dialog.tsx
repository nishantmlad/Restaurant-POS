"use client";

import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateFloor } from "@/hooks/use-tables";
import { ApiError } from "@/lib/api";

export function RenameFloorDialog({
  branchId,
  floorId,
  currentName,
  trigger,
}: {
  branchId: string | null;
  floorId: string;
  currentName: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | undefined>();
  const updateFloor = useUpdateFloor(branchId);

  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Floor name is required");
      toast.error("Floor name is required");
      return;
    }
    setError(undefined);
    updateFloor.mutate(
      { id: floorId, name: name.trim() },
      {
        onSuccess: () => {
          toast.success("Floor renamed");
          setOpen(false);
          setError(undefined);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not rename floor"),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(currentName);
          setError(undefined);
        }
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg border-border/80 text-xs">
              <Pencil className="h-3.5 w-3.5" />
              <span>Rename floor</span>
            </Button>
          )
        }
      />
      <DialogContent>
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Rename floor</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-4">
            <Label htmlFor="rename-floor">Name</Label>
            <Input
              id="rename-floor"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(undefined);
              }}
              aria-invalid={Boolean(error)}
              autoFocus
            />
            {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateFloor.isPending}>
              {updateFloor.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
