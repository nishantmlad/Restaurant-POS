"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useIngredients,
  useRecipe,
  useSetRecipe,
  useSetTracking,
  useTracking,
  type Ingredient,
  type InventoryTracking,
  type RecipeLine,
} from "@/hooks/use-inventory";
import { ApiError } from "@/lib/api";
import {
  getConversionFactor,
  getDefaultUnitAndQty,
  getUnitOptions,
  round3,
  toBaseQuantity,
  type UnitOption,
} from "@/lib/stock-units";

const MODES: { value: InventoryTracking; label: string; hint: string }[] = [
  { value: "NONE", label: "Not tracked", hint: "Selling it never changes stock." },
  { value: "RECIPE", label: "Recipe", hint: "Deducts the ingredients below for each one sold." },
  { value: "DIRECT", label: "Stock item", hint: "Deducts one stock item as-is (bottled drinks, packaged goods)." },
];

export { getConversionFactor, getDefaultUnitAndQty, getUnitOptions, toBaseQuantity };
export type { UnitOption };

interface Line {
  ingredientId: string;
  quantity: string;
  unit: string;
}

const selectClass =
  "h-10 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground";

export function StockTrackingSection({
  branchId,
  itemId,
  isCombo,
}: {
  branchId: string | null;
  itemId: string;
  isCombo: boolean;
}) {
  const { data: tracking } = useTracking(branchId, itemId);
  const { data: recipe } = useRecipe(branchId, itemId);
  const { data: ingredients } = useIngredients(branchId);

  if (isCombo) {
    return (
      <p className="rounded-lg border border-border px-3 py-2.5 text-xs text-muted-foreground">
        Combos deduct stock through their component items. Set tracking on each component.
      </p>
    );
  }
  if (!tracking || !recipe || !ingredients) return null;

  return (
    <TrackingForm
      key={itemId}
      branchId={branchId}
      itemId={itemId}
      ingredients={ingredients}
      initialMode={tracking.inventoryTracking}
      initialDirectId={tracking.stockIngredientId ?? ""}
      initialDirectQty={String(tracking.stockDisplayQuantity ?? tracking.stockQuantityPerSale)}
      initialDirectUnit={tracking.stockDisplayUnit}
      initialRecipeLines={recipe.lines}
    />
  );
}

function TrackingForm({
  branchId,
  itemId,
  ingredients,
  initialMode,
  initialDirectId,
  initialDirectQty,
  initialDirectUnit,
  initialRecipeLines,
}: {
  branchId: string | null;
  itemId: string;
  ingredients: Ingredient[];
  initialMode: InventoryTracking;
  initialDirectId: string;
  initialDirectQty: string;
  initialDirectUnit?: string;
  initialRecipeLines: RecipeLine[];
}) {
  const setTracking = useSetTracking(branchId, itemId);
  const setRecipe = useSetRecipe(branchId, itemId);

  const [mode, setMode] = useState<InventoryTracking>(initialMode);
  const [directId, setDirectId] = useState(initialDirectId);
  const [directUnit, setDirectUnit] = useState(() => {
    if (initialDirectUnit) return initialDirectUnit;
    const ing = ingredients.find((i) => i.id === initialDirectId);
    const parsed = getDefaultUnitAndQty(Number(initialDirectQty) || 1, ing?.unit);
    return parsed.unit;
  });
  const [directQty, setDirectQty] = useState(() => {
    if (initialDirectUnit) return initialDirectQty;
    const ing = ingredients.find((i) => i.id === initialDirectId);
    const parsed = getDefaultUnitAndQty(Number(initialDirectQty) || 1, ing?.unit);
    return parsed.qty;
  });

  const [lines, setLines] = useState<Line[]>(() =>
    initialRecipeLines.map((l) => {
      const ing = ingredients.find((i) => i.id === l.ingredientId);
      // If user had previously saved a display unit and display quantity, keep exact match
      if (l.unit && l.displayQuantity != null && l.displayQuantity > 0) {
        return {
          ingredientId: l.ingredientId,
          quantity: String(l.displayQuantity),
          unit: l.unit,
        };
      }
      const parsed = getDefaultUnitAndQty(Number(l.quantity) || 1, ing?.unit);
      return {
        ingredientId: l.ingredientId,
        quantity: parsed.qty,
        unit: parsed.unit,
      };
    }),
  );

  const directIng = ingredients.find((i) => i.id === directId);

  const handleDirectIngredientChange = (newId: string) => {
    setDirectId(newId);
    const ing = ingredients.find((i) => i.id === newId);
    const parsed = getDefaultUnitAndQty(1, ing?.unit);
    setDirectUnit(parsed.unit);
    setDirectQty(parsed.qty);
  };

  const handleDirectUnitChange = (newUnit: string) => {
    const oldQty = Number(directQty) || 0;
    if (oldQty > 0 && directUnit !== newUnit) {
      const oldFactor = getConversionFactor(directUnit, directIng?.unit);
      const newFactor = getConversionFactor(newUnit, directIng?.unit);
      const baseQty = oldQty * oldFactor;
      const converted = round3(baseQty / newFactor);
      setDirectQty(String(converted));
    }
    setDirectUnit(newUnit);
  };

  const handleIngredientChange = (idx: number, newIngredientId: string) => {
    const ing = ingredients.find((i) => i.id === newIngredientId);
    const parsed = getDefaultUnitAndQty(1, ing?.unit);
    setLines(
      lines.map((l, i) =>
        i === idx
          ? {
              ...l,
              ingredientId: newIngredientId,
              unit: parsed.unit,
              quantity: l.quantity && Number(l.quantity) > 0 ? l.quantity : parsed.qty,
            }
          : l,
      ),
    );
  };

  const handleLineUnitChange = (idx: number, newUnit: string) => {
    const line = lines[idx];
    if (!line) return;
    const ing = ingredients.find((i) => i.id === line.ingredientId);
    const oldQty = Number(line.quantity) || 0;
    if (oldQty > 0 && line.unit !== newUnit) {
      const oldFactor = getConversionFactor(line.unit, ing?.unit);
      const newFactor = getConversionFactor(newUnit, ing?.unit);
      const baseQty = oldQty * oldFactor;
      const converted = round3(baseQty / newFactor);
      setLines(
        lines.map((l, i) =>
          i === idx ? { ...l, unit: newUnit, quantity: String(converted) } : l,
        ),
      );
    } else {
      setLines(lines.map((l, i) => (i === idx ? { ...l, unit: newUnit } : l)));
    }
  };

  const handleAddLine = () => {
    const firstUnused = ingredients.find((i) => !lines.some((l) => l.ingredientId === i.id));
    const targetIng = firstUnused ?? ingredients[0];
    const parsed = getDefaultUnitAndQty(1, targetIng?.unit);
    setLines([
      ...lines,
      {
        ingredientId: targetIng?.id ?? "",
        quantity: parsed.qty,
        unit: parsed.unit,
      },
    ]);
  };

  const incomplete =
    (mode === "DIRECT" && !directId) ||
    (mode === "RECIPE" && lines.filter((l) => l.ingredientId).length === 0);

  const save = async () => {
    try {
      if (mode === "RECIPE") {
        const clean = lines
          .filter((l) => l.ingredientId && Number(l.quantity) > 0)
          .map((l) => {
            const ing = ingredients.find((i) => i.id === l.ingredientId);
            const baseQty = toBaseQuantity(Number(l.quantity), l.unit, ing?.unit);
            return {
              ingredientId: l.ingredientId,
              quantity: baseQty > 0 ? baseQty : Number(l.quantity),
              unit: l.unit,
              displayQuantity: Number(l.quantity),
            };
          });
        await setRecipe.mutateAsync(clean);
        await setTracking.mutateAsync({ inventoryTracking: "RECIPE" });
      } else if (mode === "DIRECT") {
        const baseQty = toBaseQuantity(Number(directQty) || 1, directUnit, directIng?.unit);
        await setTracking.mutateAsync({
          inventoryTracking: "DIRECT",
          stockIngredientId: directId,
          stockQuantityPerSale: baseQty > 0 ? baseQty : (Number(directQty) || 1),
          stockDisplayQuantity: Number(directQty) || 1,
          stockDisplayUnit: directUnit,
        });
      } else {
        await setTracking.mutateAsync({ inventoryTracking: "NONE" });
      }
      toast.success("Stock tracking saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save stock tracking");
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-3" aria-label="Stock tracking">
      <div>
        <h3 className="text-sm font-medium text-foreground">Stock when sold</h3>
        <p className="text-xs text-muted-foreground">{MODES.find((m) => m.value === mode)?.hint}</p>
      </div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Stock tracking mode">
        {MODES.map((m) => (
          <Button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={mode === m.value}
            variant={mode === m.value ? "default" : "outline"}
            size="sm"
            onClick={() => setMode(m.value)}
          >
            {m.label}
          </Button>
        ))}
      </div>

      {mode === "DIRECT" && (
        <div className="grid grid-cols-[1fr_80px_100px] gap-2 items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="direct-ingredient">Stock item</Label>
            <select
              id="direct-ingredient"
              className={selectClass}
              value={directId}
              onChange={(e) => handleDirectIngredientChange(e.target.value)}
            >
              <option value="">Choose…</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit.toLowerCase()})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="direct-qty">Qty</Label>
            <Input
              id="direct-qty"
              type="number"
              min="0.001"
              step="any"
              value={directQty}
              onChange={(e) => setDirectQty(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="direct-unit">Unit</Label>
            <select
              id="direct-unit"
              className={selectClass}
              value={directUnit}
              onChange={(e) => handleDirectUnitChange(e.target.value)}
            >
              {getUnitOptions(directIng?.unit).map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {mode === "RECIPE" && (
        <div className="flex flex-col gap-2">
          {lines.length > 0 && (
            <div className="grid grid-cols-[1fr_80px_100px_36px] gap-2 text-xs font-medium text-muted-foreground px-0.5">
              <span>Ingredient</span>
              <span>Qty</span>
              <span>Unit</span>
              <span></span>
            </div>
          )}
          {lines.map((line, idx) => {
            const ing = ingredients.find((i) => i.id === line.ingredientId);
            const unitOpts = getUnitOptions(ing?.unit);
            return (
              <div key={idx} className="grid grid-cols-[1fr_80px_100px_36px] items-center gap-2">
                <select
                  aria-label="Ingredient"
                  className={selectClass}
                  value={line.ingredientId}
                  onChange={(e) => handleIngredientChange(idx, e.target.value)}
                >
                  <option value="">Choose ingredient…</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit.toLowerCase()})
                    </option>
                  ))}
                </select>
                <Input
                  aria-label="Quantity"
                  type="number"
                  min="0.001"
                  step="any"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) =>
                    setLines(
                      lines.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)),
                    )
                  }
                />
                <select
                  aria-label="Unit"
                  className={selectClass}
                  value={line.unit}
                  onChange={(e) => handleLineUnitChange(idx, e.target.value)}
                >
                  {unitOpts.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-9 text-muted-foreground hover:text-destructive"
                  aria-label="Remove ingredient"
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start mt-1"
            onClick={handleAddLine}
          >
            <Plus className="h-4 w-4 mr-1" /> Add ingredient
          </Button>
        </div>
      )}

      {incomplete && (
        <p className="text-xs text-warning">
          Choose the stock to deduct, otherwise selling this item deducts nothing.
        </p>
      )}
      <Button
        type="button"
        size="sm"
        className="self-end"
        disabled={setTracking.isPending || setRecipe.isPending}
        onClick={save}
      >
        Save stock tracking
      </Button>
    </section>
  );
}
