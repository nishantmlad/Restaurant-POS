"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Select2, type Select2Option } from "@/components/ui/select2";
import { useCreateQuotation, useIngredients, useSuppliers } from "@/hooks/use-inventory";
import { ApiError } from "@/lib/api";

interface Row {
  ingredientId: string;
  quantityQuoted: string;
  unitPrice: string;
}

const emptyRow: Row = { ingredientId: "", quantityQuoted: "", unitPrice: "" };

export function CreateQuotationDialog({ branchId }: { branchId: string | null }) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);
  const { data: suppliers } = useSuppliers(branchId);
  const { data: ingredients } = useIngredients(branchId);
  const createQuotation = useCreateQuotation(branchId);

  const supplierOptions: Select2Option[] = useMemo(
    () =>
      suppliers?.map((s) => ({
        value: s.id,
        label: s.name,
        hint: s.contactName || undefined,
        keywords: [s.name, s.contactName ?? "", s.phone ?? ""].filter(Boolean),
      })) ?? [],
    [suppliers],
  );

  const ingredientOptions: Select2Option[] = useMemo(
    () =>
      ingredients?.map((i) => ({
        value: i.id,
        label: `${i.name} (${i.unit})`,
        hint: Number(i.costPerUnit) > 0 ? `₹${i.costPerUnit}/${i.unit}` : undefined,
        keywords: [i.name, i.unit, i.sku ?? ""].filter(Boolean),
      })) ?? [],
    [ingredients],
  );

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const canSubmit =
    !!supplierId &&
    rows.length > 0 &&
    rows.every((r) => r.ingredientId && Number(r.quantityQuoted) > 0 && Number(r.unitPrice) >= 0);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createQuotation.mutate(
      {
        supplierId,
        items: rows.map((r) => ({
          ingredientId: r.ingredientId,
          quantityQuoted: Number(r.quantityQuoted),
          unitPrice: Number(r.unitPrice),
        })),
      },
      {
        onSuccess: (quotation) => {
          toast.success(`${quotation.quotationNumber} recorded`);
          setOpen(false);
          setSupplierId("");
          setRows([{ ...emptyRow }]);
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Could not record quotation"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">New quotation</Button>} />
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Record a supplier quotation</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="quote-supplier">Supplier</Label>
            <Select2
              id="quote-supplier"
              value={supplierId}
              onChange={setSupplierId}
              options={supplierOptions}
              placeholder="Select a supplier"
              searchPlaceholder="Search supplier by name or contact…"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Items quoted</Label>
            <div className="flex flex-col gap-2.5">
              {rows.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <Select2
                      value={row.ingredientId}
                      onChange={(val) => updateRow(index, { ingredientId: val })}
                      options={ingredientOptions}
                      placeholder="Select ingredient…"
                      searchPlaceholder="Search ingredient…"
                    />
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="Qty"
                    className="w-20 shrink-0"
                    value={row.quantityQuoted}
                    onChange={(e) => updateRow(index, { quantityQuoted: e.target.value })}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price/unit"
                    className="w-24 shrink-0"
                    value={row.unitPrice}
                    onChange={(e) => updateRow(index, { unitPrice: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    disabled={rows.length === 1}
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-1"
              onClick={() => setRows((prev) => [...prev, { ...emptyRow }])}
            >
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!canSubmit || createQuotation.isPending}>
              {createQuotation.isPending ? "Saving…" : "Save quotation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
