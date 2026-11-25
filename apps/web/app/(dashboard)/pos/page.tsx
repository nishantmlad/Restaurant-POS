"use client";

import { ChevronLeft, Maximize2, Minimize2, MonitorSmartphone, ShoppingCart } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { StatusNote, useNoteToast } from "@/components/ui/status-note";
import { publishDisplay, subscribeDisplayRequests } from "@/lib/customer-display";
import { BranchNotice } from "@/components/layout/branch-notice";
import { CartPanel, type DeliveryDetails, type PosOrderType } from "@/components/pos/cart-panel";
import { cartLineKey, portionText, type CartLine, type Portion } from "@/components/pos/cart-line";
import { clearDraft, switchTableDraft, type Drafts } from "@/lib/pos-drafts";
import { CheckoutPanel } from "@/components/pos/checkout-panel";
import { KitchenProgressWidget } from "@/components/pos/kitchen-progress-widget";
import { ModifierPickerDialog } from "@/components/pos/modifier-picker-dialog";
import { PosTablePicker } from "@/components/pos/pos-table-picker";
import { ProductGrid } from "@/components/pos/product-grid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBranch } from "@/hooks/use-branch";
import { useSettings } from "@/hooks/use-settings";
import type { MenuItem } from "@/hooks/use-menu";
import {
  useAddOrderItems,
  useCreateOrder,
  useOpenOrdersForTable,
  type CreatedOrder,
  type OpenOrder,
} from "@/hooks/use-orders";
import { useFloors, type RestaurantTable } from "@/hooks/use-tables";
import { ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function PosPage() {
  return (
    <Suspense fallback={null}>
      <PosPageInner />
    </Suspense>
  );
}

function PosPageInner() {
  const { branchId, isLoading: branchLoading } = useBranch();
  const { data: settings } = useSettings(branchId);
  const { note, clear: clearNote, toast } = useNoteToast();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pos_fullscreen_mode");
      if (saved === "true") {
        setIsFullscreen(true);
      }
    }

    const updateTime = () => {
      setTimeStr(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        localStorage.setItem("pos_fullscreen_mode", "false");
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } else if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearInterval(interval);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      localStorage.setItem("pos_fullscreen_mode", next ? "true" : "false");
      try {
        if (next) {
          if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        } else {
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
        }
      } catch {
        // Ignore fullscreen API restrictions if blocked by browser policy
      }
      return next;
    });
  };
  const floorsQuery = useFloors(branchId);
  const floors = floorsQuery.data;
  const tables = floors?.flatMap((f) => f.tables) ?? [];
  const preselectedTableId = useSearchParams().get("tableId") ?? "";

  const [lines, setLines] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<PosOrderType>("DINE_IN");
  const [delivery, setDelivery] = useState<DeliveryDetails>({ address: "", pincode: "", phone: "" });
  const [scheduledFor, setScheduledFor] = useState("");
  const [tableId, setTableIdRaw] = useState(preselectedTableId);
  // Unsent cart per table, so switching tables never moves or loses items.
  const [drafts, setDrafts] = useState<Drafts<CartLine>>({});
  const setTableId = (next: string) => {
    if (next === tableId) return;
    const r = switchTableDraft(drafts, tableId, next, lines);
    setDrafts(r.drafts);
    setLines(r.lines);
    setSelectedBillId(null);
    setTableIdRaw(next);
  };
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [pickerItem, setPickerItem] = useState<MenuItem | null>(null);
  const [activeOrder, setActiveOrder] = useState<CreatedOrder | null>(null);
  const [activeCustomer, setActiveCustomer] = useState<OpenOrder["customer"]>(null);
  // /pos?tableId=... can change while this page stays mounted.
  const [seenPreselected, setSeenPreselected] = useState(preselectedTableId);
  if (preselectedTableId !== seenPreselected) {
    setSeenPreselected(preselectedTableId);
    if (preselectedTableId && !activeOrder) setTableId(preselectedTableId);
  }
  // Phones show the menu full-screen and the cart/checkout as an overlay; from
  // lg up both sit side by side and this flag is ignored.
  const [cartOpen, setCartOpen] = useState(false);

  // Mirror the cart to the customer-facing display (/customer-display).
  useEffect(() => {
    if (activeOrder) return;
    const broadcast = () => {
      publishDisplay(
        lines.length === 0
          ? { kind: "idle" }
          : {
              kind: "cart",
              lines: lines.map((l) => ({
                name: l.modifierLabel ? `${l.name} (${l.modifierLabel})` : l.name,
                quantity: l.quantity,
                total: l.unitPrice * l.quantity,
              })),
              subtotal: lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
            },
      );
    };
    broadcast();
    const unsub = subscribeDisplayRequests(broadcast);
    return () => unsub();
  }, [lines, activeOrder]);

  const createOrder = useCreateOrder(branchId);
  const addOrderItems = useAddOrderItems(branchId);
  const openBillsQuery = useOpenOrdersForTable(
    branchId,
    orderType === "DINE_IN" ? tableId || null : null,
  );
  const existingOrders = openBillsQuery.data;
  // A table can carry several open bills; the user picks which one gets the
  // new items (default: the newest). Until the table's bills are loaded we do
  // not know whether this is a new bill or a new round, so submitting waits.
  const checkingTable =
    orderType === "DINE_IN" && !!tableId && (openBillsQuery.isPending || openBillsQuery.isFetching);
  const isCreatingNewBill = selectedBillId === "NEW";
  const existingOrder = isCreatingNewBill
    ? null
    : (existingOrders?.find((o) => o.id === selectedBillId) ?? existingOrders?.[0]);

  const addLine = (
    menuItemId: string,
    name: string,
    unitPrice: number,
    modifierIds: string[],
    modifierLabel: string,
    portion?: Portion,
  ) => {
    const key = cartLineKey(menuItemId, modifierIds, portion);
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { key, menuItemId, name, unitPrice, quantity: 1, modifierIds, modifierLabel, portion }];
    });
  };

  const handleSelect = (item: MenuItem) => {
    if (item.modifierGroups.length > 0 || item.halfPrice != null) {
      setPickerItem(item);
      return;
    }
    addLine(item.id, item.name, Number(item.price), [], "");
  };

  const handleModifierConfirm = (modifierIds: string[], modifierLabel: string, portion?: Portion) => {
    if (!pickerItem) return;
    const modifierTotal = modifierIds.reduce((sum, id) => {
      const mod = pickerItem.modifierGroups
        .flatMap((g) => g.modifierGroup.modifiers)
        .find((m) => m.id === id);
      return sum + (mod ? Number(mod.priceAdjustment) : 0);
    }, 0);
    const base =
      portion?.customPrice ??
      (portion?.kind === "HALF" ? Number(pickerItem.halfPrice) : Number(pickerItem.price));
    addLine(
      pickerItem.id,
      portion ? `${pickerItem.name} (${portionText(portion)})` : pickerItem.name,
      base + modifierTotal,
      modifierIds,
      modifierLabel,
      portion,
    );
  };

  const updateQuantity = (key: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const handleSubmit = () => {
    if (checkingTable) return;
    const sentTableId = tableId;
    const items = lines.map((l) => ({
      menuItemId: l.menuItemId,
      quantity: l.quantity,
      modifierIds: l.modifierIds,
      ...(l.portion
        ? {
            portion: l.portion.kind,
            customPrice: l.portion.customPrice,
            ...(l.portion.kind === "CUSTOM" ? { customLabel: l.portion.customLabel } : {}),
          }
        : {}),
    }));

    if (existingOrder) {
      addOrderItems.mutate(
        { orderId: existingOrder.id, dto: { items } },
        {
          onSuccess: (order) => {
            setDrafts((d) => clearDraft(d, sentTableId));
            setActiveCustomer(existingOrder.customer);
            setActiveOrder(order);
            toast.success(`Added to order #${order.orderNumber} — sent to kitchen`);
          },
          onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not add items"),
        },
      );
      return;
    }

    createOrder.mutate(
      {
        type: orderType,
        tableId: orderType === "DINE_IN" ? tableId : undefined,
        ...(orderType === "DELIVERY" ? { delivery } : {}),
        ...(orderType !== "DINE_IN" && scheduledFor
          ? { scheduledFor: new Date(scheduledFor).toISOString() }
          : {}),
        items,
      },
      {
        onSuccess: (order) => {
          setDrafts((d) => clearDraft(d, sentTableId));
          setActiveCustomer(null);
          setActiveOrder(order);
          setCartOpen(true);
          toast.success(`Order #${order.orderNumber} sent to kitchen`);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not create order"),
      },
    );
  };

  const viewExistingOrder = () => {
    if (existingOrder) {
      setActiveCustomer(existingOrder.customer);
      setActiveOrder(existingOrder);
      setCartOpen(true);
    }
  };

  const resetForNewOrder = () => {
    setActiveOrder(null);
    setCartOpen(false);
    // The sent cart is gone; other tables' unsent drafts stay.
    setLines([]);
    setSelectedBillId(null);
    setTableIdRaw("");
    setActiveCustomer(null);
    setDelivery({ address: "", pincode: "", phone: "" });
    setScheduledFor("");
  };

  const [showTablePicker, setShowTablePicker] = useState(false);

  const handleTablePick = (table: RestaurantTable) => {
    setTableId(table.id);
    setShowTablePicker(false);
  };

  return (
    <div
      className={cn(
        "flex flex-col transition-all duration-150",
        isFullscreen
          ? "fixed inset-0 z-40 h-screen w-screen bg-background p-2 sm:p-3 gap-2 sm:gap-2.5 overflow-hidden"
          : "h-[calc(100dvh-6rem)] sm:h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-8rem)] gap-2.5 sm:gap-3 lg:gap-4",
      )}
    >
      <StatusNote note={note} onClear={clearNote} />

      {isFullscreen ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/80 pb-2 px-1">
          <div className="flex items-center gap-3 min-w-0">
            {settings?.restaurant?.logoUrl ? (
              <img
                src={settings.restaurant.logoUrl}
                alt="Logo"
                className="h-7 w-7 rounded-md object-contain shrink-0"
              />
            ) : null}
            <div className="flex items-baseline gap-1.5 truncate">
              <span className="font-bold text-sm tracking-tight text-foreground">
                {settings?.restaurant?.name ?? "POS"}
              </span>
              <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                · {settings?.branch?.name ?? ""}
              </span>
            </div>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <KitchenProgressWidget branchId={branchId} />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {timeStr && (
              <span className="text-xs font-semibold tabular-nums text-muted-foreground hidden md:inline px-2 py-1 rounded-md bg-secondary/50">
                {timeStr}
              </span>
            )}
            <a
              href="/customer-display"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="Opens the customer-facing screen in a new window"
            >
              <MonitorSmartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Customer display</span>
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="h-8 gap-1.5 text-xs font-semibold hover:bg-secondary"
              title="Exit full screen (Esc)"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              <span>Exit Full Screen</span>
              <kbd className="hidden sm:inline-block rounded bg-muted px-1 text-[10px] text-muted-foreground">Esc</kbd>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <KitchenProgressWidget branchId={branchId} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/customer-display"
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="Opens the customer-facing screen in a new window — drag it to the second monitor"
            >
              <MonitorSmartphone className="h-3.5 w-3.5" />
              Customer display
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="h-8 gap-1.5 text-xs font-semibold hover:bg-secondary"
              title="Expand POS to full screen (F11)"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Full Screen</span>
            </Button>
          </div>
        </div>
      )}

      <BranchNotice />

      {showTablePicker ? (
        <Card className="flex-1 overflow-hidden p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Select Table</h2>
              <p className="text-xs text-muted-foreground">Pick a table for this order</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTablePicker(false)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to menu
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PosTablePicker
              floors={floors ?? []}
              onSelect={handleTablePick}
              isLoading={floorsQuery.isLoading || branchLoading}
              error={floorsQuery.isError ? floorsQuery.error : null}
              onRetry={() => void floorsQuery.refetch()}
              retrying={floorsQuery.isFetching}
            />
          </div>
        </Card>
      ) : (
        <div
          className={cn(
            "grid min-h-0 flex-1 grid-cols-1 overflow-hidden",
            isFullscreen
              ? "gap-2.5 sm:gap-3.5 sm:grid-cols-[1fr_290px] md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_370px] xl:grid-cols-[1fr_400px]"
              : "gap-3 sm:gap-4 sm:grid-cols-[1fr_280px] md:grid-cols-[1fr_310px] lg:grid-cols-[1fr_350px] xl:grid-cols-[1fr_380px]",
          )}
        >
          <Card className={cn("min-h-0 overflow-hidden", isFullscreen ? "p-2.5 sm:p-3.5" : "p-3 sm:p-4")}>
            <ProductGrid branchId={branchId} onSelect={handleSelect} />
          </Card>

          <Card
            className={cn(
              "min-h-0 flex flex-col overflow-hidden",
              isFullscreen ? "p-2.5 sm:p-3.5" : "p-3 sm:p-4",
              cartOpen
                ? "max-sm:fixed max-sm:inset-0 max-sm:z-40 max-sm:rounded-none max-sm:p-4 max-sm:pt-[max(1rem,env(safe-area-inset-top))] max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]"
                : "max-sm:hidden",
            )}
          >
            <button
              type="button"
              onClick={() => setCartOpen(false)}
              className="mb-2 -ml-1 flex items-center gap-1 text-sm font-medium text-muted-foreground sm:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to menu
            </button>
            {activeOrder ? (
              <CheckoutPanel
                order={activeOrder}
                branchId={branchId}
                initialCustomer={activeCustomer}
                onDone={resetForNewOrder}
              />
            ) : (
              <CartPanel
                lines={lines}
                orderType={orderType}
                onOrderTypeChange={setOrderType}
                tables={tables}
                floors={floors ?? []}
                tableId={tableId}
                onTableChange={setTableId}
                onIncrement={(key) => updateQuantity(key, 1)}
                onDecrement={(key) => updateQuantity(key, -1)}
                onRemove={removeLine}
                onSubmit={handleSubmit}
                isSubmitting={createOrder.isPending || addOrderItems.isPending}
                existingOrderNumber={existingOrder?.orderNumber}
                existingOrder={existingOrder}
                onViewExistingOrder={existingOrder ? viewExistingOrder : undefined}
                openBills={existingOrders?.map((o) => ({
                  id: o.id,
                  orderNumber: o.orderNumber,
                  guestName: o.guestName,
                }))}
                selectedBillId={isCreatingNewBill ? "NEW" : (existingOrder?.id ?? null)}
                onSelectBill={setSelectedBillId}
                checkingTable={checkingTable}
                delivery={delivery}
                onDeliveryChange={setDelivery}
                scheduledFor={scheduledFor}
                onScheduledForChange={setScheduledFor}
                onOpenTablePicker={() => setShowTablePicker(true)}
              />
            )}
          </Card>
        </div>
      )}

      {!showTablePicker && !cartOpen && (lines.length > 0 || activeOrder || existingOrder) && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 items-center justify-between rounded-2xl bg-primary px-4 text-primary-foreground shadow-lg active:scale-[0.98] sm:hidden"
          style={{ backgroundImage: "var(--gradient-primary)" }}
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="h-5 w-5" />
            {activeOrder
              ? `Order #${activeOrder.orderNumber} — pay`
              : lines.length > 0
                ? `View cart · ${lines.reduce((n, l) => n + l.quantity, 0)} items`
                : `Open bill #${existingOrder?.orderNumber} — view`}
          </span>
          {!activeOrder && lines.length > 0 && (
            <span className="text-sm font-semibold tabular-nums">
              {formatCurrency(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0))}
            </span>
          )}
        </button>
      )}

      <ModifierPickerDialog
        item={pickerItem}
        open={!!pickerItem}
        onOpenChange={(open) => !open && setPickerItem(null)}
        onConfirm={handleModifierConfirm}
        allowCustom
      />
    </div>
  );
}
