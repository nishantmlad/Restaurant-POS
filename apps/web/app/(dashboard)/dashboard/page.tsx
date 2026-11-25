"use client";

import { BranchNotice } from "@/components/layout/branch-notice";
import { ChefHat, ClipboardList, Flame, Globe, ReceiptText, Store, Timer, TrendingUp, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LowInventoryCard } from "@/components/dashboard/low-inventory-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { OrderDetailDialog } from "@/components/orders/order-detail-dialog";
import { RefundDialog } from "@/components/orders/refund-dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranch } from "@/hooks/use-branch";
import { useManagedOrders } from "@/hooks/use-orders";
import { openEntity } from "@/lib/entity-events";
import { useDashboardSummary, useDashboardTrends } from "@/hooks/use-dashboard";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const ONLINE_ORDER_TYPES = new Set(["QR_ORDER", "KIOSK"]);

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  accent?: "success" | "warning";
}) {
  return (
    <Card className="flex flex-col gap-3 p-6">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            accent === "success" && "bg-success/10 text-success",
            accent === "warning" && "bg-warning/10 text-warning",
            !accent && "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </span>
    </Card>
  );
}

function TableStatusRow({ label, count, dotClass }: { label: string; count: number; dotClass: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", dotClass)} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className="font-medium tabular-nums text-foreground">{count}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { branchId } = useBranch();
  const { data, isLoading } = useDashboardSummary(branchId);
  const { data: trends, isLoading: trendsLoading } = useDashboardTrends(branchId);
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time overview of today&apos;s service</p>
      </div>

      <OrderDetailDialog
        branchId={branchId}
        orderId={viewingOrderId}
        open={!!viewingOrderId}
        onOpenChange={(open) => !open && setViewingOrderId(null)}
      />

      <BranchNotice />

      <PendingOrdersBanner branchId={branchId} />

      <QuickActions />

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Today's Revenue"
            value={formatCurrency(data.todayRevenue)}
            icon={Wallet}
            accent="success"
          />
          <Link href="/orders" className="block rounded-xl transition hover:opacity-90" title="Manage orders">
            <StatCard label="Today's Orders" value={String(data.todayOrders)} icon={ReceiptText} />
          </Link>
          <StatCard
            label="Occupied Tables"
            value={String(data.tables.occupied)}
            icon={ClipboardList}
          />
          <StatCard
            label="Kitchen Queue"
            value={String(
              data.kitchenQueue.new + data.kitchenQueue.accepted + data.kitchenQueue.preparing,
            )}
            icon={Flame}
            accent="warning"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 items-stretch">
        {/* Left 2 columns: Trend Charts & Operational Status */}
        <div className="flex flex-col gap-4 xl:col-span-2 h-full">
          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TrendChart
              title="Revenue — last 14 days"
              icon={TrendingUp}
              data={trends?.revenue ?? []}
              valueKey="amount"
              color="var(--success)"
              valueFormatter={(v) => formatCurrency(v)}
              isLoading={trendsLoading}
              emptyMessage="No paid orders in the last 14 days yet."
            />
            <TrendChart
              title="Food waste cost — last 14 days"
              icon={Trash2}
              data={trends?.waste ?? []}
              valueKey="cost"
              color="var(--warning)"
              valueFormatter={(v) => formatCurrency(v)}
              isLoading={trendsLoading}
              emptyMessage="No waste logged in the last 14 days — nice."
            />
          </div>

          {/* Tables & Kitchen Queue Status */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 flex-1">
            <Card className="flex flex-col justify-between p-6 h-full">
              <div>
                <h2 className="mb-3 text-[18px] font-medium text-foreground">Tables</h2>
                {data && (
                  <div className="flex flex-col divide-y divide-border/40">
                    <TableStatusRow label="Available" count={data.tables.available} dotClass="bg-success" />
                    <TableStatusRow label="Occupied" count={data.tables.occupied} dotClass="bg-primary" />
                    <TableStatusRow label="Reserved" count={data.tables.reserved} dotClass="bg-warning" />
                    <TableStatusRow label="Cleaning" count={data.tables.cleaning} dotClass="bg-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-border/40 mt-3">
                <Link
                  href="/tables"
                  className="text-xs font-medium text-primary hover:underline flex items-center justify-between group"
                >
                  <span>View floor plan</span>
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
              </div>
            </Card>

            <Card className="flex flex-col justify-between p-6 h-full">
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-[18px] font-medium text-foreground">
                  <ChefHat className="h-[18px] w-[18px] text-muted-foreground" />
                  Kitchen queue
                </h2>
                {data && (
                  <div className="flex flex-col divide-y divide-border/40">
                    <TableStatusRow label="New" count={data.kitchenQueue.new} dotClass="bg-primary" />
                    <TableStatusRow label="Accepted" count={data.kitchenQueue.accepted} dotClass="bg-warning" />
                    <TableStatusRow label="Preparing" count={data.kitchenQueue.preparing} dotClass="bg-warning" />
                    <TableStatusRow label="Ready" count={data.kitchenQueue.ready} dotClass="bg-success" />
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-border/40 mt-3">
                <Link
                  href="/kds"
                  className="text-xs font-medium text-primary hover:underline flex items-center justify-between group"
                >
                  <span>Open kitchen display</span>
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
              </div>
            </Card>
          </div>
        </div>

        {/* Right column: Recent Transactions */}
        <div className="flex flex-col xl:col-span-1 h-full">
          <Card className="flex flex-col gap-3 p-6 h-full max-h-[530px] min-h-[380px]">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 shrink-0">
              <h2 className="flex items-center gap-2 text-[18px] font-medium text-foreground">
                <Timer className="h-[18px] w-[18px] text-muted-foreground" />
                Recent transactions
              </h2>
              <Link href="/orders" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="flex flex-col divide-y divide-border overflow-y-auto flex-1 min-h-0 pr-1">
              {data?.recentOrders.length === 0 && (
                <p className="py-12 text-center text-sm text-muted-foreground">No sales yet today.</p>
              )}
              {data?.recentOrders.map((order) => {
                const isOnline = ONLINE_ORDER_TYPES.has(order.type);
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-2.5 text-left text-sm transition"
                  >
                    <button
                      type="button"
                      onClick={() => setViewingOrderId(order.id)}
                      className="flex min-w-0 flex-1 flex-col text-left transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md"
                      title="View order details"
                    >
                      <span className="font-medium text-foreground">#{order.orderNumber}</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "mt-0.5 w-fit text-[11px] font-normal",
                          isOnline && "bg-primary/10 text-primary",
                        )}
                      >
                        {order.type.replace("_", " ")}
                      </Badge>
                    </button>
                    <div className="flex items-center gap-2 shrink-0 pl-2">
                      <span className="font-medium tabular-nums text-foreground">
                        {formatCurrency(order.totalAmount)}
                      </span>
                      <RefundDialog
                        branchId={branchId}
                        orderId={order.id}
                        orderNumber={order.orderNumber}
                        maxAmount={Number(order.totalAmount)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* 2-Column Section: Low Inventory Alert Details & Order Channels */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 items-stretch">
        <LowInventoryCard branchId={branchId} />

        {/* Order Channels Section */}
        <Card className="flex flex-col gap-4 p-6 h-full justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-border/60 pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-[18px] font-semibold text-foreground">
              <ReceiptText className="h-5 w-5 text-muted-foreground" />
              Order channels
            </h2>
            <p className="text-xs text-muted-foreground">Today&apos;s distribution: self-serve vs staff-entered orders</p>
          </div>
          {data && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Total orders today:</span>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {data.channels.online + data.channels.offline}
              </span>
            </div>
          )}
        </div>

        {data && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Online Channel Box */}
              <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">Online Channels</span>
                    <p className="text-xs text-muted-foreground">QR code ordering &amp; Self-order Kiosk</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {data.channels.online}
                  </span>
                  <div className="text-xs text-muted-foreground">
                    {data.channels.online + data.channels.offline > 0
                      ? `${Math.round((data.channels.online / (data.channels.online + data.channels.offline)) * 100)}%`
                      : "0%"}
                  </div>
                </div>
              </div>

              {/* Offline Channel Box */}
              <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">Offline Channels</span>
                    <p className="text-xs text-muted-foreground">POS Dine-in, Takeaway &amp; Phone orders</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold tabular-nums text-foreground">
                    {data.channels.offline}
                  </span>
                  <div className="text-xs text-muted-foreground">
                    {data.channels.online + data.channels.offline > 0
                      ? `${Math.round((data.channels.offline / (data.channels.online + data.channels.offline)) * 100)}%`
                      : "0%"}
                  </div>
                </div>
              </div>
            </div>

            {/* Distribution Progress Bar */}
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex justify-between text-xs text-muted-foreground font-medium">
                <span>Online self-serve ({data.channels.online})</span>
                <span>Offline counter ({data.channels.offline})</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: `${
                      data.channels.online + data.channels.offline === 0
                        ? 0
                        : (data.channels.online / (data.channels.online + data.channels.offline)) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}

// Online orders waiting for a decision — shown on top so they can't be missed.
function PendingOrdersBanner({ branchId }: { branchId: string | null }) {
  const { data } = useManagedOrders(branchId, "pending");
  if (!data || data.length === 0) return null;
  return (
    <Card className="flex flex-col gap-3 border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {data.length} online order{data.length === 1 ? "" : "s"} waiting for you
        </p>
        <p className="text-xs text-muted-foreground">Accept or reject so the kitchen can start.</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => openEntity("Order", data[0].id)}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          Review #{data[0].orderNumber}
        </button>
        <Link href="/orders" className="rounded-lg border border-border px-3 py-1.5 text-sm">
          All orders
        </Link>
      </div>
    </Card>
  );
}
