"use client";

import { useState } from "react";
import { CheckoutPanel } from "@/components/pos/checkout-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useOpenOrdersForTable } from "@/hooks/use-orders";
import type { RestaurantTable } from "@/hooks/use-tables";
import { formatCurrency } from "@/lib/format";

export function BillTableDialog({
  branchId,
  table,
  open,
  onOpenChange,
}: {
  branchId: string | null;
  table: RestaurantTable;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: orders, isLoading } = useOpenOrdersForTable(branchId, open ? table.id : null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const order = orders?.find((o) => o.id === selectedOrderId) ?? orders?.[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bill {table.name ?? `Table ${table.number}`}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : !order ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No open order found for this table.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {orders && orders.length > 1 && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-muted/30 p-2.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Select bill to settle:</span>
                  <span className="font-semibold text-primary">{orders.length} bills</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {orders.map((o, idx) => {
                    const isSelected = order.id === o.id;
                    return (
                      <Button
                        key={o.id}
                        type="button"
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        className="h-8 gap-1.5 px-3 text-xs font-semibold"
                        onClick={() => setSelectedOrderId(o.id)}
                      >
                        <span>Tab {idx + 1}: #{o.orderNumber}</span>
                        {o.guestName && <span className="font-normal opacity-85">({o.guestName})</span>}
                        <span className="tabular-nums font-bold">· {formatCurrency(o.totalAmount)}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
            <CheckoutPanel
              order={order}
              branchId={branchId}
              initialCustomer={order.customer}
              onDone={() => onOpenChange(false)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
