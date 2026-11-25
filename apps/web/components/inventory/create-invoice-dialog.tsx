"use client";

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
import { useCreateSupplierInvoice, useSuppliers } from "@/hooks/use-inventory";
import { ApiError } from "@/lib/api";

export function CreateInvoiceDialog({ branchId }: { branchId: string | null }) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const { data: suppliers } = useSuppliers(branchId);
  const createInvoice = useCreateSupplierInvoice(branchId);

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

  const canSubmit = !!supplierId && !!invoiceNumber && !!invoiceDate && Number(totalAmount) > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createInvoice.mutate(
      {
        supplierId,
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        totalAmount: Number(totalAmount),
      },
      {
        onSuccess: (invoice) => {
          toast.success(`${invoice.invoiceNumber} added`);
          setOpen(false);
          setSupplierId("");
          setInvoiceNumber("");
          setDueDate("");
          setTotalAmount("");
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Could not add supplier invoice"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">New invoice</Button>} />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add a vendor invoice</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="inv-supplier">Supplier</Label>
            <Select2
              id="inv-supplier"
              value={supplierId}
              onChange={setSupplierId}
              options={supplierOptions}
              placeholder="Select a supplier"
              searchPlaceholder="Search supplier by name or contact…"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Invoice number</Label>
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Invoice date</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Total amount</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!canSubmit || createInvoice.isPending}>
              {createInvoice.isPending ? "Saving…" : "Add invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
