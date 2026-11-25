"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { IngredientUnit } from "@nodedr-restaurant/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateIngredient } from "@/hooks/use-inventory";
import { ApiError } from "@/lib/api";

const UNITS: IngredientUnit[] = ["KG", "G", "L", "ML", "PIECE", "DOZEN", "PACK", "BOX"];

export function AddIngredientDialog({ branchId }: { branchId: string | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<IngredientUnit>("KG");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [errors, setErrors] = useState<{ name?: string; costPerUnit?: string; reorderLevel?: string }>({});
  const createIngredient = useCreateIngredient(branchId);

  const reset = () => {
    setName("");
    setUnit("KG");
    setCostPerUnit("");
    setReorderLevel("0");
    setErrors({});
  };

  const validate = () => {
    const errs: typeof errors = {};
    if (!name.trim()) {
      errs.name = "Ingredient name is required";
    }
    if (costPerUnit.trim() && (isNaN(Number(costPerUnit)) || Number(costPerUnit) < 0)) {
      errs.costPerUnit = "Cost per unit must be 0 or higher";
    }
    if (reorderLevel.trim() && (isNaN(Number(reorderLevel)) || Number(reorderLevel) < 0)) {
      errs.reorderLevel = "Reorder level must be 0 or higher";
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
    createIngredient.mutate(
      {
        name: name.trim(),
        unit,
        reorderLevel: Number(reorderLevel) || 0,
        costPerUnit: Number(costPerUnit) || 0,
        isActive: true,
      },
      {
        onSuccess: () => {
          toast.success(`${name} added`);
          setOpen(false);
          reset();
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Could not add ingredient"),
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
      <DialogTrigger render={<Button size="sm">New ingredient</Button>} />
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New ingredient</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-name">Name</Label>
            <Input
              id="i-name"
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
            <Label>Unit</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as IngredientUnit)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="i-cost">Cost / unit</Label>
              <Input
                id="i-cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={costPerUnit}
                onChange={(e) => {
                  setCostPerUnit(e.target.value);
                  if (errors.costPerUnit)
                    setErrors((prev) => ({ ...prev, costPerUnit: undefined }));
                }}
                aria-invalid={Boolean(errors.costPerUnit)}
              />
              {errors.costPerUnit && (
                <p className="text-xs font-medium text-destructive">{errors.costPerUnit}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="i-reorder">Reorder level</Label>
              <Input
                id="i-reorder"
                type="number"
                min="0"
                step="0.001"
                value={reorderLevel}
                onChange={(e) => {
                  setReorderLevel(e.target.value);
                  if (errors.reorderLevel)
                    setErrors((prev) => ({ ...prev, reorderLevel: undefined }));
                }}
                aria-invalid={Boolean(errors.reorderLevel)}
              />
              {errors.reorderLevel && (
                <p className="text-xs font-medium text-destructive">{errors.reorderLevel}</p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Reorder level triggers a Low Stock alert once current stock falls to or below it.
          </p>
          <DialogFooter>
            <Button type="submit" disabled={createIngredient.isPending}>
              {createIngredient.isPending ? "Adding…" : "Add ingredient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
