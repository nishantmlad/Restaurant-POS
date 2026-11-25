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
import { Select2, type Select2Option } from "@/components/ui/select2";
import { useCreatePurchaseRequest, useIngredients } from "@/hooks/use-inventory";
import { ApiError } from "@/lib/api";

interface Row {
  ingredientId: string;
  quantityRequested: string;
}

const emptyRow: Row = { ingredientId: "", quantityRequested: "" };

export function CreatePurchaseRequestDialog({ branchId }: { branchId: string | null }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);
  const { data: ingredients } = useIngredients(branchId);
  const createRequest = useCreatePurchaseRequest(branchId);

  const ingredientOptions: Select2Option[] = useMemo(
    () =>
      ingredients?.map((i) => ({
        value: i.id,
        label: `${i.name} (${i.unit})`,
        hint: Number(i.currentStock) > 0 ? `${i.currentStock} ${i.unit} in stock` : undefined,
        keywords: [i.name, i.unit, i.sku ?? ""].filter(Boolean),
      })) ?? [],
    [ingredients],
  );

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const canSubmit =
    rows.length > 0 && rows.every((r) => r.ingredientId && Number(r.quantityRequested) > 0);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createRequest.mutate(
      {
        notes: notes || undefined,
        items: rows.map((r) => ({
          ingredientId: r.ingredientId,
          quantityRequested: Number(r.quantityRequested),
        })),
      },
      {
        onSuccess: (request) => {
          toast.success(`${request.requestNumber} created`);
          setOpen(false);
          setNotes("");
          setRows([{ ...emptyRow }]);
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Could not create purchase request"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">New request</Button>} />
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New purchase request</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label>Items</Label>
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
                    className="w-24 shrink-0"
                    value={row.quantityRequested}
                    onChange={(e) => updateRow(index, { quantityRequested: e.target.value })}
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

          <div className="flex flex-col gap-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!canSubmit || createRequest.isPending}>
              {createRequest.isPending ? "Creating…" : "Create request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
