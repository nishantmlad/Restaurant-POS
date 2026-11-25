"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLowStockIngredients } from "@/hooks/use-inventory";
import { cn } from "@/lib/utils";

export function LowInventoryCard({ branchId }: { branchId: string | null }) {
  const { data: lowStockItems, isLoading } = useLowStockIngredients(branchId);

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }

  const items = (lowStockItems ?? []).slice().sort((a, b) => {
    // Out of stock first
    const aStock = Number(a.currentStock);
    const bStock = Number(b.currentStock);
    if (aStock <= 0 && bStock > 0) return -1;
    if (bStock <= 0 && aStock > 0) return 1;
    // Then lowest percentage of reorder level
    const aRatio = Number(a.reorderLevel) > 0 ? aStock / Number(a.reorderLevel) : 1;
    const bRatio = Number(b.reorderLevel) > 0 ? bStock / Number(b.reorderLevel) : 1;
    return aRatio - bRatio;
  });

  const count = items.length;

  return (
    <Card className="flex flex-col gap-4 p-6 h-full">
      <div className="flex items-center justify-between border-b border-border/60 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl",
              count > 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
            )}
          >
            {count > 0 ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-semibold text-foreground">Low inventory</h2>
              {count > 0 && (
                <Badge variant="destructive" className="h-5 text-[11px] font-semibold px-2">
                  {count} {count === 1 ? "item" : "items"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {count > 0
                ? "Raw materials and stock items at or below reorder threshold"
                : "All raw materials are well stocked"}
            </p>
          </div>
        </div>

        <Link
          href="/inventory"
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1 group"
        >
          <span>Manage inventory</span>
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>

      {count === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-2 flex-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-foreground">Stock levels healthy</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            No ingredients are currently at or below their reorder level.
          </p>
          <Link href="/inventory" className="mt-2">
            <Button variant="outline" size="sm" className="text-xs">
              View all inventory
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border/50 overflow-y-auto max-h-[360px] pr-1 flex-1">
          {items.map((item) => {
            const stock = Number(item.currentStock);
            const reorder = Number(item.reorderLevel);
            const isOutOfStock = stock <= 0;
            const ratio = reorder > 0 ? Math.min(100, Math.max(0, (stock / reorder) * 100)) : 0;
            const deficit = Math.max(0, reorder - stock);

            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 py-3 first:pt-1 last:pb-1 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-foreground truncate">{item.name}</span>
                    <Badge
                      variant={isOutOfStock ? "destructive" : "secondary"}
                      className={cn(
                        "text-[10px] px-1.5 py-0 font-medium shrink-0",
                        !isOutOfStock &&
                          "bg-warning/15 text-warning-foreground dark:text-warning border-warning/30",
                      )}
                    >
                      {isOutOfStock ? "Out of stock" : "Low stock"}
                    </Badge>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        isOutOfStock ? "text-destructive" : "text-foreground",
                      )}
                    >
                      {item.currentStock} {item.unit}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      / min {item.reorderLevel} {item.unit}
                    </span>
                  </div>
                </div>

                {/* Progress bar towards reorder level */}
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        "h-full transition-all duration-300 rounded-full",
                        isOutOfStock || ratio < 25 ? "bg-destructive" : "bg-amber-500",
                      )}
                      style={{ width: `${isOutOfStock ? 0 : ratio}%` }}
                    />
                  </div>
                  {deficit > 0 && (
                    <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                      Need +{deficit} {item.unit}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {count > 0 && (
        <div className="pt-3 border-t border-border/40 flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground">
            {count} {count === 1 ? "ingredient needs" : "ingredients need"} attention
          </span>
          <div className="flex items-center gap-2">
            <Link href="/inventory/procurement">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>Create PO</span>
              </Button>
            </Link>
            <Link href="/inventory">
              <Button size="sm" className="h-8 text-xs gap-1.5">
                <span>View in inventory</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
