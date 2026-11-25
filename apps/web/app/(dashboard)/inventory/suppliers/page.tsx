"use client";

import { Mail, Pencil, Phone, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddSupplierDialog } from "@/components/inventory/add-supplier-dialog";
import { EditSupplierDialog } from "@/components/inventory/edit-supplier-dialog";
import { InventoryTabs } from "@/components/inventory/inventory-tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { useBranch } from "@/hooks/use-branch";
import { useDeleteSupplier, useSuppliers, type Supplier } from "@/hooks/use-inventory";
import { ApiError } from "@/lib/api";

export default function SuppliersPage() {
  const { branchId } = useBranch();
  const [search, setSearch] = useState("");
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const { data: suppliers, isLoading } = useSuppliers(branchId);
  const deleteSupplier = useDeleteSupplier(branchId);
  const confirm = useConfirm();

  const filtered = suppliers?.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const onDelete = async (supplier: Supplier) => {
    const ok = await confirm({
      title: `Delete ${supplier.name}?`,
      description: "This supplier will be permanently removed from your branch suppliers list.",
      confirmText: "Delete supplier",
      cancelText: "Cancel",
      variant: "destructive",
      icon: "trash",
    });
    if (!ok) return;
    deleteSupplier.mutate(supplier.id, {
      onSuccess: () => toast.success(`${supplier.name} deleted`),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Could not delete supplier"),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Ingredients, recipe costing, purchase orders, and waste
          </p>
        </div>
        <AddSupplierDialog branchId={branchId} />
      </div>

      <InventoryTabs />

      <Input
        placeholder="Search suppliers…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <Card className="flex flex-col divide-y divide-border p-2">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          filtered.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.contactName || "No contact person on file"}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {s.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {s.phone}
                    </span>
                  )}
                  {s.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {s.email}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 pl-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/50"
                    title={`Edit ${s.name}`}
                    onClick={() => setEditingSupplier(s)}
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/50"
                    title={`Delete ${s.name}`}
                    onClick={() => onDelete(s)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No suppliers yet</p>
            <p className="text-sm text-muted-foreground">
              Add a supplier before creating your first purchase order.
            </p>
          </div>
        )}
      </Card>

      {editingSupplier && (
        <EditSupplierDialog
          key={editingSupplier.id}
          branchId={branchId}
          supplier={editingSupplier}
          onClose={() => setEditingSupplier(null)}
        />
      )}
    </div>
  );
}
