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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCreateCategory } from "@/hooks/use-menu";
import { ApiError } from "@/lib/api";

export function AddCategoryDialog({ branchId }: { branchId: string | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [showOnWebsite, setShowOnWebsite] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const createCategory = useCreateCategory(branchId);

  const reset = () => {
    setName("");
    setShowOnWebsite(true);
    setError(undefined);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category name is required");
      toast.error("Category name is required");
      return;
    }
    setError(undefined);
    createCategory.mutate(
      { name: name.trim(), sortOrder: 0, isActive: true, showOnWebsite },
      {
        onSuccess: () => {
          toast.success(`"${name.trim()}" category added`);
          setOpen(false);
          reset();
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not add category"),
      },
    );
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
          <Button variant="outline" size="sm">
            Add category
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-4">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(undefined);
              }}
              placeholder="e.g. Starters"
              aria-invalid={Boolean(error)}
              autoFocus
            />
            {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          </div>
          <label className="mb-4 flex min-h-12 items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
            <span className="flex flex-col">
              <span className="text-sm font-medium text-foreground">Show on website</span>
              <span className="text-xs text-muted-foreground">
                Off hides this category from your website and online/QR ordering. It stays on the POS.
              </span>
            </span>
            <Switch checked={showOnWebsite} onCheckedChange={setShowOnWebsite} aria-label="Show on website" />
          </label>
          <DialogFooter>
            <Button type="submit" disabled={createCategory.isPending}>
              {createCategory.isPending ? "Adding…" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
