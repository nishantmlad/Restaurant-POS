"use client";

import {
  AlertCircle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  DollarSign,
  Eye,
  Flame,
  LayoutGrid,
  List,
  Package,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  User,
  Utensils,
  X,
  XCircle,
} from "lucide-react";
import { kitchenProgress } from "@nodedr-restaurant/types";
import { useMemo, useState } from "react";
import { ScanOrderInput } from "@/components/orders/scan-order-input";
import { DeleteOrdersDialog } from "@/components/orders/delete-orders-dialog";
import { ReasonDialog } from "@/components/orders/reason-dialog";
import { SettleOrderDialog } from "@/components/orders/settle-order-dialog";
import { ChannelBadge, TypeBadge } from "@/components/orders/channel-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { hasPermission, useCurrentUser } from "@/hooks/use-auth";
import { useBranch } from "@/hooks/use-branch";
import {
  useAcceptOrder,
  useManagedOrders,
  useRejectOrder,
  type ManagedOrder,
  type OrderChannel,
  type OrderTab,
} from "@/hooks/use-orders";
import { formatCurrency } from "@/lib/format";
import { openReceiptPrint } from "@/lib/print";
import { openEntity } from "@/lib/entity-events";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TABS: { key: OrderTab; label: string; icon: typeof Clock }[] = [
  { key: "pending", label: "Needs Action", icon: AlertCircle },
  { key: "active", label: "Active Orders", icon: ChefHat },
  { key: "history", label: "Order History", icon: Receipt },
];

const FILTERS: {
  key: string;
  label: string;
  icon?: typeof Utensils;
  channel?: OrderChannel;
  type?: string;
}[] = [
  { key: "all", label: "All Orders" },
  { key: "online", label: "Online Orders", channel: "ONLINE" },
  { key: "offline", label: "Counter POS", channel: "STAFF" },
  { key: "dinein", label: "Dine-in", type: "DINE_IN", icon: Utensils },
  { key: "takeaway", label: "Takeaway", type: "TAKEAWAY", icon: ShoppingBag },
  { key: "delivery", label: "Delivery", type: "DELIVERY", icon: Package },
];

function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function OrdersPage() {
  const { branchId } = useBranch();
  const [tab, setTab] = useState<OrderTab>("pending");
  const [filterKey, setFilterKey] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];

  // Queries for live counts and active tab
  const { data: pendingOrders, isLoading: loadingPending } = useManagedOrders(branchId, "pending");
  const { data: activeOrders, isLoading: loadingActive } = useManagedOrders(branchId, "active");
  const { data: historyOrders, isLoading: loadingHistory } = useManagedOrders(branchId, "history");

  const { data: currentOrders, isLoading } = useManagedOrders(
    branchId,
    tab,
    filter.channel,
    filter.type,
  );

  const pendingCount = pendingOrders?.length ?? 0;
  const activeCount = activeOrders?.length ?? 0;
  const historyCount = historyOrders?.length ?? 0;

  // Total sales volume from completed history
  const totalVolume = useMemo(() => {
    return (historyOrders ?? [])
      .filter((o) => o.status === "PAID")
      .reduce((acc, o) => acc + Number(o.totalAmount || 0), 0);
  }, [historyOrders]);

  // Client-side search filtering
  const filteredOrders = useMemo(() => {
    if (!currentOrders) return [];
    if (!searchQuery.trim()) return currentOrders;
    const q = searchQuery.toLowerCase().trim();
    return currentOrders.filter((o) => {
      const name = (o.guestName ?? o.customer?.name ?? "").toLowerCase();
      const num = o.orderNumber.toLowerCase();
      const tbl = o.table ? String(o.table.number || o.table.name || "").toLowerCase() : "";
      const items = o.items.map((i) => i.nameSnapshot.toLowerCase()).join(" ");
      return num.includes(q) || name.includes(q) || tbl.includes(q) || items.includes(q);
    });
  }, [currentOrders, searchQuery]);

  // Admin-only multi-select delete of finished transactions (History tab).
  const { data: me } = useCurrentUser();
  const canDelete =
    hasPermission(me?.user, "orders.delete") &&
    ["OWNER", "ADMINISTRATOR"].includes(me?.user.roleName ?? "");
  const selectable = canDelete && tab === "history";
  const finished = (currentOrders ?? []).filter(
    (o) => o.status === "PAID" || o.status === "CANCELLED",
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [settleOrder, setSettleOrder] = useState<ManagedOrder | null>(null);
  const visibleSelected = finished.filter((o) => selected.has(o.id)).map((o) => o.id);
  const allSelected = finished.length > 0 && visibleSelected.length === finished.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(finished.map((o) => o.id)));

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[30px] font-bold tracking-tight text-foreground">
              Orders Management
            </h1>
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Orders
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor real-time kitchen tickets, dispatch orders, and manage transaction history
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card p-1 shadow-xs">
          <Button
            type="button"
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-8 gap-1.5 text-xs font-medium"
            title="Card Grid View"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cards View</span>
          </Button>
          <Button
            type="button"
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-8 gap-1.5 text-xs font-medium"
            title="Dense List View"
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">List View</span>
          </Button>
        </div>
      </div>

      {/* Hero KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Needs Action */}
        <button
          type="button"
          onClick={() => {
            setTab("pending");
            setSelected(new Set());
          }}
          className={cn(
            "flex flex-col justify-between rounded-2xl border p-4 text-left transition-all relative overflow-hidden",
            tab === "pending"
              ? "border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20 shadow-md"
              : "border-border bg-card hover:bg-secondary/40 shadow-xs",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Needs Action
            </span>
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl",
                pendingCount > 0 ? "bg-amber-500 text-white animate-bounce" : "bg-amber-500/10 text-amber-600",
              )}
            >
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {pendingCount}
            </span>
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {pendingCount > 0 ? "Awaiting kitchen accept" : "All cleared"}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Tap to view pending online / kiosk orders
          </div>
        </button>

        {/* Card 2: In Kitchen / Preparing */}
        <button
          type="button"
          onClick={() => {
            setTab("active");
            setSelected(new Set());
          }}
          className={cn(
            "flex flex-col justify-between rounded-2xl border p-4 text-left transition-all relative overflow-hidden",
            tab === "active"
              ? "border-sky-500 bg-sky-500/5 ring-2 ring-sky-500/20 shadow-md"
              : "border-border bg-card hover:bg-secondary/40 shadow-xs",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Orders
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
              <ChefHat className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {activeCount}
            </span>
            <span className="text-xs font-medium text-sky-600 dark:text-sky-400">
              Active tickets
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Cooking &amp; awaiting settlement
          </div>
        </button>

        {/* Card 3: Settled Orders */}
        <button
          type="button"
          onClick={() => {
            setTab("history");
            setSelected(new Set());
          }}
          className={cn(
            "flex flex-col justify-between rounded-2xl border p-4 text-left transition-all relative overflow-hidden",
            tab === "history"
              ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20 shadow-md"
              : "border-border bg-card hover:bg-secondary/40 shadow-xs",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Completed Orders
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {historyCount}
            </span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Settled in history
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Fully paid and fulfilled bills
          </div>
        </button>

        {/* Card 4: Total Volume */}
        <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recorded Sales Volume
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-foreground tabular-nums">
              {formatCurrency(totalVolume)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Gross revenue from completed transactions
          </div>
        </div>
      </div>

      {/* Barcode & Search Controls Bar */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter orders by #number, customer name, food item, or table…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-card border-border shadow-xs text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="w-full md:w-auto">
          <ScanOrderInput branchId={branchId} />
        </div>
      </div>

      {/* Tabs & Sub-Filter Chips */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
        {/* Main Status Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/80 pb-3">
          {TABS.map((t) => {
            const Icon = t.icon;
            const count =
              t.key === "pending"
                ? pendingCount
                : t.key === "active"
                  ? activeCount
                  : historyCount;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setSelected(new Set());
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all shadow-xs",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                <span
                  className={cn(
                    "ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                    active
                      ? "bg-white/20 text-white"
                      : count > 0 && t.key === "pending"
                        ? "bg-destructive text-white"
                        : "bg-secondary text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Fulfillment Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">Filter by:</span>
          {FILTERS.map((f) => {
            const active = filterKey === f.key;
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterKey(f.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {Icon && <Icon className="h-3 w-3" />}
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Select All Checkbox (Admin History only) */}
      {selectable && finished.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <label className="flex w-fit cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label="Select all transactions"
            />
            Select all {finished.length} completed orders for deletion
          </label>
          <span className="text-xs text-muted-foreground">
            Showing {filteredOrders.length} order(s)
          </span>
        </div>
      )}

      {/* Main Order Display: Grid or List */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : filteredOrders.length > 0 ? (
        viewMode === "grid" ? (
          /* Cards Grid View */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                branchId={branchId}
                selectable={selectable && (order.status === "PAID" || order.status === "CANCELLED")}
                selected={selected.has(order.id)}
                onToggle={() => toggle(order.id)}
                onSettle={setSettleOrder}
              />
            ))}
          </div>
        ) : (
          /* List View */
          <Card className="flex flex-col divide-y divide-border p-2 rounded-2xl shadow-xs">
            {filteredOrders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                branchId={branchId}
                selectable={selectable && (order.status === "PAID" || order.status === "CANCELLED")}
                selected={selected.has(order.id)}
                onToggle={() => toggle(order.id)}
                onSettle={setSettleOrder}
              />
            ))}
          </Card>
        )
      ) : (
        /* Empty State */
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center rounded-2xl border-dashed">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/80 text-muted-foreground">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">
              {searchQuery
                ? `No orders matching "${searchQuery}"`
                : tab === "pending"
                  ? "No new orders waiting for action"
                  : tab === "active"
                    ? "No orders currently cooking in kitchen"
                    : "No orders found in history"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {tab === "pending"
                ? "New online and kiosk orders will automatically pop up here with an alert chime."
                : "Try resetting your search or selecting a different status filter above."}
            </p>
          </div>
          {searchQuery && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="mt-1"
            >
              Clear search query
            </Button>
          )}
        </Card>
      )}

      {/* Floating Action Bar for Batch Delete */}
      <div
        aria-hidden={visibleSelected.length === 0}
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
          visibleSelected.length > 0 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 shadow-[0_12px_32px_rgba(23,21,34,0.18)] ring-1 ring-black/5",
            visibleSelected.length > 0 && "pointer-events-auto",
          )}
        >
          <span className="text-sm font-semibold tabular-nums text-foreground" aria-live="polite">
            {visibleSelected.length} order(s) selected
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tabIndex={visibleSelected.length > 0 ? 0 : -1}
            onClick={() => setSelected(new Set())}
            className="h-8 text-xs"
          >
            <X className="h-3.5 w-3.5 mr-1" aria-hidden /> Clear
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            tabIndex={visibleSelected.length > 0 ? 0 : -1}
            onClick={() => setConfirmOpen(true)}
            className="h-8 text-xs font-semibold"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden /> Delete Selected
          </Button>
        </div>
      </div>

      <DeleteOrdersDialog
        branchId={branchId}
        orderIds={visibleSelected}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDeleted={() => setSelected(new Set())}
      />

      <SettleOrderDialog
        open={!!settleOrder}
        onOpenChange={(open) => !open && setSettleOrder(null)}
        branchId={branchId}
        order={settleOrder}
      />
    </div>
  );
}

function getKitchenStatusBadge(order: ManagedOrder) {
  const isPending = order.acceptance === "PENDING";
  const isRejected = order.acceptance === "REJECTED";
  const isPaid = order.status === "PAID";
  const isCancelled = !isRejected && order.status === "CANCELLED";

  if (isPending) {
    return (
      <Badge className="bg-amber-500 text-white font-semibold text-[11px] px-2 py-0.5 animate-pulse shadow-xs">
        <AlertCircle className="h-3 w-3 mr-1" /> Needs Action
      </Badge>
    );
  }

  if (isRejected) {
    return (
      <Badge variant="secondary" className="text-destructive font-medium text-[11px] px-2 py-0.5">
        <XCircle className="h-3 w-3 mr-1" /> Rejected
      </Badge>
    );
  }

  if (isCancelled) {
    return (
      <Badge variant="secondary" className="text-muted-foreground font-medium text-[11px] px-2 py-0.5">
        Cancelled
      </Badge>
    );
  }

  // Resolve Kitchen Stage
  const kotStatuses = (order.kots ?? []).map((k) => k.status);
  const stage = kitchenProgress(kotStatuses);

  if (stage === "NEW") {
    return (
      <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-semibold text-[11px] px-2 py-0.5">
        <Clock className="h-3 w-3 mr-1" /> Kitchen: New
      </Badge>
    );
  }

  if (stage === "ACCEPTED") {
    return (
      <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-semibold text-[11px] px-2 py-0.5">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Kitchen: Accepted
      </Badge>
    );
  }

  if (stage === "PREPARING") {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-bold text-[11px] px-2 py-0.5">
        <Flame className="h-3 w-3 mr-1 text-amber-500 animate-pulse" /> Kitchen: Preparing
      </Badge>
    );
  }

  if (stage === "READY") {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40 font-black text-[11px] px-2.5 py-0.5 shadow-2xs">
        <Bell className="h-3 w-3 mr-1 text-emerald-600 animate-bounce" /> Kitchen: Ready
      </Badge>
    );
  }

  if (stage === "SERVED") {
    return (
      <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/30 font-medium text-[11px] px-2 py-0.5">
        <Check className="h-3 w-3 mr-1" /> Kitchen: Served
      </Badge>
    );
  }

  // Fallback for orders with no KOT tickets
  if (isPaid) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-semibold text-[11px] px-2 py-0.5">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Completed &amp; Paid
      </Badge>
    );
  }

  return (
    <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 font-medium text-[11px] px-2 py-0.5">
      <Utensils className="h-3 w-3 mr-1" /> Active
    </Badge>
  );
}

/** Rich Card View for Individual Order */
function OrderCard({
  order,
  branchId,
  selectable,
  selected,
  onToggle,
  onSettle,
}: {
  order: ManagedOrder;
  branchId: string | null;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
  onSettle: (order: ManagedOrder) => void;
}) {
  const accept = useAcceptOrder(branchId);
  const reject = useRejectOrder(branchId);
  const [rejectOpen, setRejectOpen] = useState(false);

  const name = order.guestName ?? order.customer?.name ?? "Walk-in Guest";
  const initials = getInitials(name);
  const isPending = order.acceptance === "PENDING";
  const isPaid = order.status === "PAID";
  const totalItemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  // Check kitchen stage for paid status tag
  const kotStatuses = (order.kots ?? []).map((k) => k.status);
  const stage = kitchenProgress(kotStatuses);

  return (
    <Card
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border transition-all duration-200 overflow-hidden bg-card hover:shadow-md",
        selected && "ring-2 ring-primary border-primary bg-primary/5",
        isPending && "border-amber-400/80 shadow-xs",
        isPaid && "border-emerald-500/30",
      )}
    >
      {/* Top Header Strip */}
      <div className="flex flex-col gap-2.5 p-4 border-b border-border/70 bg-secondary/15">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {selectable && (
              <Checkbox
                checked={selected}
                onCheckedChange={onToggle}
                aria-label={`Select order #${order.orderNumber}`}
                className="mr-1"
              />
            )}
            {(order as any).dailyToken != null && (
              <Badge className="bg-primary/20 text-primary hover:bg-primary/25 border-0 font-extrabold text-xs px-2 py-0.5">
                Token #{(order as any).dailyToken}
              </Badge>
            )}
            <span className="text-base font-black tracking-tight text-foreground">
              #{order.orderNumber}
            </span>
            {order.table && (
              <Badge variant="outline" className="border-primary/30 text-primary font-bold text-[11px]">
                <Utensils className="h-2.5 w-2.5 mr-1" />
                Table #{order.table.number}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Clock className="h-3 w-3" />
            {timeAgo(order.createdAt)}
          </div>
        </div>

        {/* Badges Bar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <ChannelBadge channel={order.channel} />
          <TypeBadge type={order.type} />
          {getKitchenStatusBadge(order)}
          {isPaid && stage && stage !== "SERVED" && (
            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 font-bold px-1.5 py-0">
              PAID
            </Badge>
          )}
        </div>
      </div>

      {/* Customer Info Strip */}
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs ring-1 ring-primary/20">
          {initials || <User className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-foreground">{name}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {order.customer?.phone ?? "Direct walk-in customer"}
          </div>
        </div>
        <Badge variant="secondary" className="text-[11px] font-semibold shrink-0">
          {totalItemCount} {totalItemCount === 1 ? "item" : "items"}
        </Badge>
      </div>

      {/* Food Items Pill List */}
      <div className="px-4 py-2">
        <div className="rounded-xl border border-border/80 bg-secondary/25 p-2.5 text-xs flex flex-col gap-1.5 max-h-[110px] overflow-y-auto no-scrollbar">
          {order.items.map((item, idx) => (
            <div key={item.id || idx} className="flex items-baseline justify-between text-foreground">
              <span className="truncate pr-2 font-medium">
                {item.nameSnapshot}
              </span>
              <span className="shrink-0 font-bold text-muted-foreground">
                ×{item.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Strip: Amount & Quick Actions */}
      <div className="flex flex-col gap-2 p-4 pt-3 border-t border-border/70 bg-card">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Order Total</span>
          <span className="text-lg font-extrabold tabular-nums text-foreground">
            {formatCurrency(order.totalAmount)}
          </span>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center gap-2 pt-1">
          {isPending ? (
            /* Accept & Reject for incoming orders */
            <>
              <Button
                type="button"
                size="sm"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9"
                disabled={accept.isPending}
                onClick={() =>
                  accept.mutate(order.id, {
                    onSuccess: () => toast.success(`Order #${order.orderNumber} accepted!`),
                    onError: () => toast.error("Could not accept order"),
                  })
                }
              >
                {accept.isPending ? "Accepting…" : "Accept Order"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs h-9 px-3"
                disabled={reject.isPending}
                onClick={() => setRejectOpen(true)}
              >
                Reject
              </Button>
            </>
          ) : (
            /* View, Pay & Print for regular orders */
            <>
              {order.status !== "PAID" && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-3 shrink-0 shadow-xs"
                  title={`Collect payment (${formatCurrency(order.totalAmount)})`}
                  onClick={() => onSettle(order)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Pay
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openEntity("Order", order.id)}
                className="flex-1 text-xs h-9 font-medium"
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                View Details
              </Button>

              {branchId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs"
                  title="Print GST Receipt"
                  onClick={() => openReceiptPrint(order.id, branchId)}
                >
                  <Printer className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                  Print
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Reject Reason Dialog */}
      <ReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={`Reject order #${order.orderNumber}?`}
        description="The customer will be notified that the order could not be accepted."
        reasons={["Kitchen too busy", "Item out of stock", "Closing time reached", "Cannot deliver to location"]}
        confirmLabel="Reject Order"
        onSubmit={(reason) =>
          reject.mutateAsync({ orderId: order.id, reason }).then(() => {
            toast.success(`Order #${order.orderNumber} rejected`);
          })
        }
      />
    </Card>
  );
}

/** Dense List View Row */
function OrderRow({
  order,
  branchId,
  selectable,
  selected,
  onToggle,
  onSettle,
}: {
  order: ManagedOrder;
  branchId: string | null;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
  onSettle: (order: ManagedOrder) => void;
}) {
  const name = order.guestName ?? order.customer?.name ?? "Walk-in Guest";
  const initials = getInitials(name);
  const summary = order.items.map((i) => `${i.quantity}× ${i.nameSnapshot}`).join(", ");
  const isPending = order.acceptance === "PENDING";
  const isPaid = order.status === "PAID";
  const isRejected = order.acceptance === "REJECTED";
  const isCancelled = !isRejected && order.status === "CANCELLED";

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3.5 transition-colors duration-150 hover:bg-secondary/40 rounded-xl",
        selected && "bg-primary/5",
      )}
    >
      {selectable && (
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Select transaction #${order.orderNumber}`}
        />
      )}

      {/* Avatar */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs ring-1 ring-primary/20">
        {initials || <User className="h-4 w-4" />}
      </div>

      {/* Order Info button */}
      <button
        type="button"
        onClick={() => openEntity("Order", order.id)}
        className="flex flex-1 items-start justify-between gap-4 text-left min-w-0"
      >
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {(order as any).dailyToken != null && (
              <Badge className="bg-primary/20 text-primary hover:bg-primary/25 border-0 font-extrabold text-[11px] px-1.5 py-0">
                Token #{(order as any).dailyToken}
              </Badge>
            )}
            <span className="text-sm font-bold text-foreground">#{order.orderNumber}</span>
            <span className="text-xs font-semibold text-foreground/90">{name}</span>
            {order.table && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold border-primary/30 text-primary">
                T#{order.table.number}
              </Badge>
            )}
            <ChannelBadge channel={order.channel} />
            <TypeBadge type={order.type} />
            {getKitchenStatusBadge(order)}
            {order.status === "PAID" && (
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 font-bold px-1.5 py-0">
                PAID
              </Badge>
            )}
          </div>
          <span className="truncate text-xs text-muted-foreground">{summary}</span>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-bold tabular-nums text-foreground">
            {formatCurrency(order.totalAmount)}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" /> {timeAgo(order.createdAt)}
          </span>
        </div>
      </button>

      {/* Quick Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {order.status !== "PAID" && !isRejected && !isCancelled && !isPending && (
          <Button
            type="button"
            size="sm"
            className="h-8 px-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            title={`Collect payment (${formatCurrency(order.totalAmount)})`}
            onClick={(e) => {
              e.stopPropagation();
              onSettle(order);
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Pay
          </Button>
        )}
        {branchId && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Print GST receipt"
            onClick={(e) => {
              e.stopPropagation();
              openReceiptPrint(order.id, branchId);
            }}
          >
            <Printer className="h-4 w-4" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="View Details"
          onClick={() => openEntity("Order", order.id)}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

