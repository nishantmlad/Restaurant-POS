"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, useMenuItems, type MenuItem } from "@/hooks/use-menu";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProductGrid({
  branchId,
  onSelect,
}: {
  branchId: string | null;
  onSelect: (item: MenuItem) => void;
}) {
  const { data: categories } = useCategories(branchId);
  const [activeCategoryId, setActiveCategoryId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const { data: items, isLoading, isError, error, refetch, isFetching } = useMenuItems(branchId, activeCategoryId);

  const filtered = useMemo(() => {
    if (!items) return [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const allCategories = useMemo(() => {
    if (!categories) return [];
    const totalCount = categories.reduce((sum, c) => sum + (c._count?.items ?? 0), 0);
    return [
      { id: undefined as string | undefined, name: "All", count: totalCount },
      ...categories.map((c) => ({
        id: c.id as string | undefined,
        name: c.name,
        count: c._count?.items as number | undefined,
      })),
    ];
  }, [categories]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2.5 sm:gap-3">
      {/* Top Search & Category Listing Bar */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search menu by item name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 sm:h-10 pl-9 pr-8 text-xs sm:text-sm bg-muted/20 border-border/80 focus-visible:bg-background"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground text-xs"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Horizontal Category Scroll Bar */}
        {allCategories.length > 0 && (
          <div className="relative -mx-1 px-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar scroll-smooth">
              {allCategories.map((c) => {
                const active = c.id === activeCategoryId;
                return (
                  <button
                    key={c.id ?? "all"}
                    type="button"
                    onClick={() => setActiveCategoryId(c.id)}
                    className={cn(
                      "shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all select-none",
                      active
                        ? "bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/20 scale-[1.01]"
                        : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95",
                    )}
                  >
                    <span>{c.name}</span>
                    {c.count !== undefined && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums",
                          active
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-background/80 text-muted-foreground border border-border/50",
                        )}
                      >
                        {c.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Item List Grid */}
      <div className="flex min-h-0 flex-1 flex-col">
        {isError && !items ? (
          <QueryError error={error} what="the menu" onRetry={() => void refetch()} retrying={isFetching} />
        ) : (
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2.5 sm:gap-3 overflow-y-auto pb-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 pr-1">
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            {filtered?.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="group flex min-h-24 sm:min-h-28 flex-col justify-between rounded-xl sm:rounded-2xl border border-border/80 bg-card p-3 sm:p-3.5 text-left shadow-xs transition-all hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0"
              >
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full shrink-0",
                        item.isVeg ? "bg-emerald-500 ring-2 ring-emerald-500/20" : "bg-red-500 ring-2 ring-red-500/20",
                      )}
                      title={item.isVeg ? "Vegetarian" : "Non-Vegetarian"}
                    />
                    {item.modifierGroups && item.modifierGroups.length > 0 && (
                      <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.2 rounded-md">
                        Custom
                      </span>
                    )}
                  </div>
                  <span className="text-xs sm:text-sm font-bold leading-snug text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                    {item.name}
                  </span>
                </div>

                <div className="flex w-full items-baseline justify-between gap-1.5 pt-2 border-t border-border/40 mt-2">
                  <span className="text-xs sm:text-sm font-black tabular-nums text-foreground">
                    {formatCurrency(item.price)}
                  </span>
                  {item.halfPrice != null && (
                    <span className="text-[10px] sm:text-[11px] font-medium tabular-nums text-muted-foreground bg-secondary/70 px-1.5 py-0.5 rounded-md shrink-0">
                      Half {formatCurrency(item.halfPrice)}
                    </span>
                  )}
                </div>
              </button>
            ))}
            {filtered?.length === 0 && !isLoading && (
              <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
                {search ? <>No items match &quot;{search}&quot;</> : "No items in this category yet"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
