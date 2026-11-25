"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
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
import { useCreateFloor } from "@/hooks/use-tables";
import { ApiError } from "@/lib/api";

export function AddFloorDialog({ branchId }: { branchId: string | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const createFloor = useCreateFloor(branchId);

  const reset = () => {
    setName("");
    setError(undefined);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Floor name is required");
      toast.error("Floor name is required");
      return;
    }
    setError(undefined);
    createFloor.mutate(name.trim(), {
      onSuccess: () => {
        toast.success(`"${name.trim()}" floor added`);
        setOpen(false);
        reset();
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not add floor"),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg border-border/80 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>Add floor</span>
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>New floor</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-4">
            <Label htmlFor="floor-name">Name</Label>
            <Input
              id="floor-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(undefined);
              }}
              placeholder="e.g. Rooftop"
              aria-invalid={Boolean(error)}
              autoFocus
            />
            {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createFloor.isPending}>
              {createFloor.isPending ? "Adding…" : "Add floor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
