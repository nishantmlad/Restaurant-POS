"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateIngredient, type Ingredient } from "@/hooks/use-inventory";
import { ApiError } from "@/lib/api";

const UNITS: IngredientUnit[] = ["KG", "G", "L", "ML", "PIECE", "DOZEN", "PACK", "BOX"];

export function EditIngredientDialog({
  branchId,
  ingredient,
}: {
  branchId: string | null;
  ingredient: Ingredient;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(ingredient.name);
  const [unit, setUnit] = useState<IngredientUnit>(ingredient.unit as IngredientUnit);
  const [reorderLevel, setReorderLevel] = useState(String(ingredient.reorderLevel ?? 0));
  const [costPerUnit, setCostPerUnit] = useState(String(ingredient.costPerUnit ?? 0));
  const [errors, setErrors] = useState<{ name?: string; costPerUnit?: string; reorderLevel?: string }>({});

  const updateIngredient = useUpdateIngredient(branchId);

  const reset = () => {
    setName(ingredient.name);
    setUnit(ingredient.unit as IngredientUnit);
    setReorderLevel(String(ingredient.reorderLevel ?? 0));
    setCostPerUnit(String(ingredient.costPerUnit ?? 0));
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

    updateIngredient.mutate(
      {
        id: ingredient.id,
        dto: {
          name: name.trim(),
          unit,
          reorderLevel: Number(reorderLevel) || 0,
          costPerUnit: Number(costPerUnit) || 0,
        },
      },
      {
        onSuccess: () => {
          toast.success(`${name.trim()} updated`);
          setOpen(false);
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Could not update ingredient"),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            title={`Edit ${ingredient.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Edit ingredient</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-i-name">Name</Label>
            <Input
              id="edit-i-name"
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
              <Label htmlFor="edit-i-cost">Avg. cost / unit</Label>
              <Input
                id="edit-i-cost"
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
              <Label htmlFor="edit-i-reorder">Reorder level</Label>
              <Input
                id="edit-i-reorder"
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateIngredient.isPending}>
              {updateIngredient.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

