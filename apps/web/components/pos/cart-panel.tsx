"use client";

import { LayoutGrid, Minus, Plus, Receipt, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CartLine } from "@/components/pos/cart-line";
import type { OpenOrder } from "@/hooks/use-orders";
import type { Floor, RestaurantTable } from "@/hooks/use-tables";
import { formatCurrency } from "@/lib/format";
import { subtotalOf } from "@/lib/pricing-preview";
import { cn } from "@/lib/utils";

export type PosOrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
export interface DeliveryDetails {
  address: string;
  pincode: string;
  phone: string;
}

export function CartPanel({
  lines,
  orderType,
  onOrderTypeChange,
  tables,
  floors = [],
  tableId,
  onTableChange,
  onIncrement,
  onDecrement,
  onRemove,
  onSubmit,
  isSubmitting,
  existingOrderNumber,
  existingOrder,
  onViewExistingOrder,
  openBills,
  selectedBillId,
  onSelectBill,
  checkingTable = false,
  delivery,
  onDeliveryChange,
  scheduledFor,
  onScheduledForChange,
  onOpenTablePicker,
}: {
  lines: CartLine[];
  orderType: PosOrderType;
  onOrderTypeChange: (type: PosOrderType) => void;
  tables: RestaurantTable[];
  floors?: Floor[];
  tableId: string;
  onTableChange: (id: string) => void;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
  onRemove: (key: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  existingOrderNumber?: string;
  existingOrder?: OpenOrder | null;
  onViewExistingOrder?: () => void;
  /** All unpaid bills on the selected table (more than one is possible). */
  openBills?: { id: string; orderNumber: string; guestName?: string | null }[];
  selectedBillId?: string | null;
  onSelectBill?: (id: string) => void;
  /** The table's open bills are still loading - sending now could start a duplicate bill. */
  checkingTable?: boolean;
  delivery: DeliveryDetails;
  onDeliveryChange: (d: DeliveryDetails) => void;
  scheduledFor: string;
  onScheduledForChange: (v: string) => void;
  onOpenTablePicker?: () => void;
}) {
  const subtotal = subtotalOf(lines.map((l) => l.unitPrice * l.quantity));
  const existingTotal = existingOrder ? Number(existingOrder.totalAmount || 0) : 0;
  const hasExistingItems = (existingOrder?.items?.length ?? 0) > 0;

  const deliveryReady =
    orderType !== "DELIVERY" ||
    (delivery.address.trim().length >= 5 && delivery.pincode.trim().length >= 3 && delivery.phone.trim().length >= 6);
  const canSubmit =
    lines.length > 0 && (orderType !== "DINE_IN" || !!tableId) && deliveryReady && !isSubmitting && !checkingTable;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <Tabs value={orderType} onValueChange={(v) => onOrderTypeChange(v as PosOrderType)}>
        <TabsList className="w-full">
          <TabsTrigger value="DINE_IN" className="flex-1">
            Dine-in
          </TabsTrigger>
          <TabsTrigger value="TAKEAWAY" className="flex-1">
            Takeaway
          </TabsTrigger>
          <TabsTrigger value="DELIVERY" className="flex-1">
            Delivery
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {orderType === "DINE_IN" && (
        <div className="flex items-center gap-1.5">
          <Select value={tableId} onValueChange={(v) => onTableChange(v ?? "")}>
            <SelectTrigger className="w-full flex-1">
              <SelectValue placeholder="Select table">
                {(value: string | null) => {
                  const t = tables.find((table) => table.id === value);
                  if (!t) return "Select table";
                  const floor = floors.find(
                    (f) => f.id === t.floorId || f.tables?.some((tb) => tb.id === t.id),
                  );
                  const floorPrefix = floor ? `${floor.name} · ` : "";
                  return `${floorPrefix}${t.name ?? `Table ${t.number}`}${t.status === "OCCUPIED" ? " (occupied)" : ""}`;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {floors && floors.length > 0 ? (
                floors.map((floor) => {
                  if (!floor.tables || floor.tables.length === 0) return null;
                  return (
                    <SelectGroup key={floor.id}>
                      <SelectLabel className="sticky top-0 z-10 bg-muted/90 backdrop-blur-xs px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-primary border-y border-border/40 select-none">
                        {floor.name} ({floor.tables.length} tables)
                      </SelectLabel>
                      {floor.tables.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="pl-3 py-1.5">
                          <span className="font-semibold">{t.name ?? `Table ${t.number}`}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">· {floor.name}</span>
                          {t.status === "OCCUPIED" && (
                            <span className="ml-auto text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              Occupied
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })
              ) : (
                tables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name ?? `Table ${t.number}`} {t.status === "OCCUPIED" ? "(occupied)" : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {onOpenTablePicker && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              title="Open visual table map"
              onClick={onOpenTablePicker}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {orderType === "DELIVERY" && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Delivery address"
            value={delivery.address}
            onChange={(e) => onDeliveryChange({ ...delivery, address: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Pincode"
              inputMode="numeric"
              value={delivery.pincode}
              onChange={(e) => onDeliveryChange({ ...delivery, pincode: e.target.value })}
            />
            <Input
              placeholder="Phone"
              inputMode="tel"
              value={delivery.phone}
              onChange={(e) => onDeliveryChange({ ...delivery, phone: e.target.value })}
            />
          </div>
        </div>
      )}

      {orderType !== "DINE_IN" && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Schedule for later (optional)
          <Input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => onScheduledForChange(e.target.value)}
          />
        </label>
      )}

      {checkingTable && (
        <p role="status" className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          Checking this table&apos;s open bills…
        </p>
      )}
      {openBills && openBills.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/30 p-2.5 text-xs text-muted-foreground" role="group" aria-label="Bills on this table">
          <div className="flex items-center justify-between font-medium text-foreground">
            <span>{openBills.length === 1 ? "1 active bill on this table:" : `${openBills.length} bills on this table:`}</span>
            {selectedBillId === "NEW" && (
              <span className="text-[11px] font-semibold text-primary">Adding 2nd Bill</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {openBills.map((b) => {
              const isSelected = b.id === selectedBillId;
              return (
                <Button
                  key={b.id}
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  className="h-7 gap-1 px-2.5 text-xs font-semibold"
                  aria-pressed={isSelected}
                  onClick={() => onSelectBill?.(b.id)}
                >
                  <span>#{b.orderNumber}</span>
                  {b.guestName && <span className="opacity-80 font-normal">({b.guestName})</span>}
                </Button>
              );
            })}
            <Button
              type="button"
              size="sm"
              variant={selectedBillId === "NEW" ? "default" : "secondary"}
              className={cn(
                "h-7 gap-1 px-2 text-xs font-semibold",
                selectedBillId === "NEW"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-dashed border-border hover:bg-muted text-foreground"
              )}
              aria-pressed={selectedBillId === "NEW"}
              onClick={() => onSelectBill?.("NEW")}
            >
              <Plus className="h-3 w-3" />
              <span>+ New Bill</span>
            </Button>
          </div>
        </div>
      )}
      {selectedBillId === "NEW" ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary font-medium">
          <span>Creating a separate new bill for this table (Shared Table).</span>
        </div>
      ) : existingOrderNumber ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          <span>
            Bill <span className="font-semibold text-foreground">#{existingOrderNumber}</span>
            {lines.length > 0 ? " — new items will be added" : " selected"}
          </span>
          {onViewExistingOrder && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs font-medium"
              onClick={onViewExistingOrder}
            >
              View & pay
            </Button>
          )}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto space-y-3 pr-1">
        {hasExistingItems && (
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between border-b border-border/60 pb-2 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <Receipt className="h-3.5 w-3.5 text-primary" />
                Already in bill #{existingOrder?.orderNumber}
              </span>
              <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {existingOrder?.items?.length} {existingOrder?.items?.length === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="divide-y divide-border/40">
              {existingOrder?.items?.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-1.5 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 font-bold tabular-nums text-foreground">
                      {item.quantity}×
                    </span>
                    <span className="truncate text-foreground/90">{item.nameSnapshot}</span>
                  </div>
                  <span className="ml-2 shrink-0 font-medium tabular-nums text-muted-foreground">
                    {formatCurrency(Number(item.lineTotal))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {lines.length > 0 ? (
          <div className={cn(hasExistingItems && "rounded-xl border border-primary/25 bg-primary/5 p-3")}>
            {hasExistingItems && (
              <div className="mb-2 flex items-center justify-between border-b border-primary/15 pb-2 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-primary">
                  <Plus className="h-3.5 w-3.5" />
                  New items to add ({lines.length})
                </span>
                <span className="font-semibold tabular-nums text-primary">
                  +{formatCurrency(subtotal)}
                </span>
              </div>
            )}
            <div className="flex flex-col divide-y divide-border">
              {lines.map((line) => (
                <div key={line.key} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{line.name}</p>
                    {line.modifierLabel && (
                      <p className="text-xs text-muted-foreground">{line.modifierLabel}</p>
                    )}
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(line.unitPrice * line.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onDecrement(line.key)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-5 text-center text-sm font-medium tabular-nums">{line.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onIncrement(line.key)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(line.key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : hasExistingItems ? (
          <div className="rounded-xl border border-dashed border-border/80 p-3.5 text-center text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Want to add more food to this table?</p>
            <p className="mt-1">Tap any item on the menu to add a new round to this bill.</p>
          </div>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <ShoppingCart className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Cart is empty</p>
            <p className="text-xs text-muted-foreground/75">Select items from the menu to start order</p>
          </div>
        )}
      </div>

      <div className="mt-auto shrink-0 flex flex-col gap-2.5 border-t border-border pt-3">
        {existingOrder && lines.length === 0 ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current bill total</span>
              <span className="text-base font-bold tabular-nums text-foreground">
                {formatCurrency(existingTotal)}
              </span>
            </div>
            {onViewExistingOrder && (
              <Button
                type="button"
                className="h-11 w-full text-sm font-semibold"
                onClick={onViewExistingOrder}
              >
                View Bill & Checkout ({formatCurrency(existingTotal)})
              </Button>
            )}
          </>
        ) : existingOrder && lines.length > 0 ? (
          <>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Existing bill ({existingOrder.items?.length || 0} items)</span>
                <span className="tabular-nums font-medium">{formatCurrency(existingTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>New items to add</span>
                <span className="tabular-nums font-medium text-primary">+{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border/60 text-sm font-bold text-foreground">
                <span>New total</span>
                <span className="tabular-nums">{formatCurrency(existingTotal + subtotal)}</span>
              </div>
            </div>
            <Button
              type="button"
              className="h-11 w-full text-sm font-semibold"
              disabled={!canSubmit}
              onClick={onSubmit}
            >
              {isSubmitting
                ? "Sending to kitchen…"
                : `Add to #${existingOrderNumber} & send (+${formatCurrency(subtotal)})`}
            </Button>
            {onViewExistingOrder && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={onViewExistingOrder}
              >
                Or settle current bill ({formatCurrency(existingTotal)}) without adding
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal (incl. tax)</span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatCurrency(subtotal)}
              </span>
            </div>
            <Button
              type="button"
              className="h-11 w-full text-sm font-semibold"
              disabled={!canSubmit}
              onClick={onSubmit}
            >
              {isSubmitting
                ? "Sending to kitchen…"
                : selectedBillId === "NEW"
                  ? "Send to kitchen (New Bill)"
                  : "Send to kitchen"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
