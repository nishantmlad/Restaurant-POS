"use client";

import { BellRing, CheckCircle2, Leaf, Minus, Plus, Receipt, Users, UtensilsCrossed } from "lucide-react";
import { use, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ModifierPickerDialog } from "@/components/pos/modifier-picker-dialog";
import { PopBurst } from "@/components/order/pop-burst";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n/context";
import { api, ApiError } from "@/lib/api";
import { playSuccessChime, vibrateSuccess } from "@/lib/celebrate";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  price: string;
  isVeg: boolean;
  modifierGroups: {
    modifierGroup: {
      id: string;
      name: string;
      minSelect: number;
      maxSelect: number;
      isRequired: boolean;
      modifiers: { id: string; name: string; priceAdjustment: string; isDefault: boolean }[];
    };
  }[];
}

// One cart line = an item plus its chosen options; the same item with
// different options is a separate line.
interface CartLine {
  key: string;
  menuItemId: string;
  modifierIds: string[];
  label: string;
  unitPrice: number;
  quantity: number;
}

interface PublicStatus {
  tableStatus?: string;
  order: {
    id?: string;
    orderNumber: string;
    status: string;
    acceptance: string;
    guestName?: string | null;
    items: { id: string; nameSnapshot: string; quantity: number; status: string }[];
  } | null;
  openRequests: ("WAITER" | "BILL")[];
}

const ITEM_STATUS_LABEL: Record<string, string> = {
  NEW: "Received",
  ACCEPTED: "Received",
  PREPARING: "Being prepared",
  READY: "Ready",
  SERVED: "Served",
  CANCELLED: "Cancelled",
};

interface PublicMenuCategory {
  id: string;
  name: string;
  items: PublicMenuItem[];
}

interface PublicMenuSession {
  orderId: string;
  orderNumber: string;
  guestName: string | null;
  status: string;
}

interface PublicMenuResponse {
  branchName: string;
  tableName: string;
  tableStatus?: string;
  categories: PublicMenuCategory[];
  activeSession?: PublicMenuSession | null;
  activeSessions?: PublicMenuSession[];
}

// Smooth cubic ease-in-out scrolling helper
function smoothScrollTo(targetY: number, duration = 700) {
  if (typeof window === "undefined") return;
  const startY = window.scrollY || window.pageYOffset;
  const difference = targetY - startY;
  if (Math.abs(difference) < 5) return;
  const startTime = performance.now();

  function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function step(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);

    window.scrollTo(0, startY + difference * eased);

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

export default function PublicMenuPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = use(params);
  const { t } = useI18n();
  const nameStorageKey = `qr-guest-name:${qrToken}`;
  const sessionOrderStorageKey = `qr-session-order:${qrToken}`;
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pickerItem, setPickerItem] = useState<PublicMenuItem | null>(null);
  const queryClient = useQueryClient();
  const [placed, setPlaced] = useState<{ orderNumber: string } | null>(null);
  const [guestName, setGuestName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [billSettled, setBillSettled] = useState(false);
  const [isNewTab, setIsNewTab] = useState(false);
  const [showSharedTableChoice, setShowSharedTableChoice] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const isClickScrollingRef = useRef(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hadActiveOrderRef = useRef(false);

  // Read any name saved earlier this session after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(nameStorageKey) || sessionStorage.getItem(nameStorageKey);
      if (saved) setGuestName(saved);
    } catch {
      // Storage unavailable in restricted environment
    }
  }, [nameStorageKey]);

  useEffect(() => {
    if (placed) {
      vibrateSuccess();
      playSuccessChime();
    }
  }, [placed]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-menu", qrToken],
    queryFn: () => api.get<PublicMenuResponse>(`/public/menu/${qrToken}`),
    retry: false,
  });

  // Bound order ID for this diner's phone
  const boundOrderId = typeof window !== "undefined" ? localStorage.getItem(sessionOrderStorageKey) : null;

  // Live status of the table's tab and any pending waiter/bill request.
  const { data: status } = useQuery({
    queryKey: ["public-status", qrToken, boundOrderId],
    queryFn: () =>
      api.get<PublicStatus>(
        `/public/menu/${qrToken}/status${boundOrderId ? `?orderId=${boundOrderId}` : ""}`
      ),
    refetchInterval: 8000,
    enabled: !!data,
  });

  // Synchronize session lifecycle with table status:
  // 1. If diner has an existing bound order on this table, resume it directly.
  // 2. If table is occupied by someone else, offer option to Join Tab or Start Separate Bill.
  // 3. If table is empty, clear old tokens and show fresh prompt.
  useEffect(() => {
    if (!data) return;

    const savedOrderId = typeof window !== "undefined" ? localStorage.getItem(sessionOrderStorageKey) : null;
    const activeSessions = data.activeSessions ?? (data.activeSession ? [data.activeSession] : []);

    if (activeSessions.length > 0) {
      const mySession = savedOrderId ? activeSessions.find((s) => s.orderId === savedOrderId) : null;

      if (mySession) {
        // Diner's phone is already bound to this active tab (e.g. ordering extra round)
        hadActiveOrderRef.current = true;
        setGuestName(mySession.guestName || "");
        setShowSharedTableChoice(false);
      } else if (!guestName && !isNewTab) {
        // Table has active orders, but this diner is new on this table -> ask join or separate
        setShowSharedTableChoice(true);
      }
    } else {
      // Table currently has no active open/billed order -> expired
      setShowSharedTableChoice(false);
      try {
        const prevOrderId = localStorage.getItem(sessionOrderStorageKey);
        if (prevOrderId) {
          localStorage.removeItem(nameStorageKey);
          localStorage.removeItem(sessionOrderStorageKey);
          sessionStorage.removeItem(nameStorageKey);
          setGuestName("");
        }
      } catch {}
    }
  }, [data, sessionOrderStorageKey, nameStorageKey, guestName, isNewTab]);

  // If order was completed/paid while customer was looking at this screen
  useEffect(() => {
    if (status?.order) {
      hadActiveOrderRef.current = true;
    } else if (hadActiveOrderRef.current && status && !status.order) {
      setBillSettled(true);
      hadActiveOrderRef.current = false;
      setGuestName("");
      try {
        localStorage.removeItem(nameStorageKey);
        localStorage.removeItem(sessionOrderStorageKey);
        sessionStorage.removeItem(nameStorageKey);
      } catch {}
    }
  }, [status, nameStorageKey, sessionOrderStorageKey]);

  // Set default active category once loaded
  useEffect(() => {
    if (data?.categories?.length && !activeCategoryId) {
      setActiveCategoryId(data.categories[0].id);
    }
  }, [data?.categories, activeCategoryId]);

  const scrollToCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    isClickScrollingRef.current = true;
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
      isClickScrollingRef.current = false;
    }, 850);

    const el = document.getElementById(`cat-${categoryId}`);
    if (el) {
      const navBarHeight = 52;
      const targetY = Math.max(0, el.getBoundingClientRect().top + window.scrollY - navBarHeight);
      smoothScrollTo(targetY, 650);
    }
    const tabEl = document.getElementById(`cat-tab-${categoryId}`);
    if (tabEl) {
      tabEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  // Scrollspy: smoothly track which category is in view on scroll
  useEffect(() => {
    if (!data?.categories?.length) return;

    let ticking = false;
    let debounceTabTimeout: NodeJS.Timeout | null = null;

    const onScroll = () => {
      if (isClickScrollingRef.current) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (isClickScrollingRef.current) return;

        // Threshold point (~90px from top) right below the sticky category bar
        const navOffset = 90;
        let currentId = data.categories[0].id;

        for (const cat of data.categories) {
          const el = document.getElementById(`cat-${cat.id}`);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (rect.top <= navOffset) {
            currentId = cat.id;
          } else {
            break;
          }
        }

        setActiveCategoryId((prev) => {
          if (prev === currentId) return prev;

          // Gentle debounced centering for the active tab pill
          if (debounceTabTimeout) clearTimeout(debounceTabTimeout);
          debounceTabTimeout = setTimeout(() => {
            const tabEl = document.getElementById(`cat-tab-${currentId}`);
            if (tabEl) {
              tabEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
            }
          }, 150);

          return currentId;
        });
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (debounceTabTimeout) clearTimeout(debounceTabTimeout);
    };
  }, [data?.categories]);

  const requestService = useMutation({
    mutationFn: (type: "WAITER" | "BILL") =>
      api.post(`/public/menu/${qrToken}/request`, { type, guestName: guestName || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["public-status", qrToken] }),
  });

  const placeOrder = useMutation({
    mutationFn: () => {
      const boundOrderId = typeof window !== "undefined" ? localStorage.getItem(sessionOrderStorageKey) : null;
      return api.post<{ orderNumber: string; id?: string }>(`/public/menu/${qrToken}/order`, {
        guestName,
        newTab: isNewTab,
        targetOrderId: isNewTab ? undefined : (boundOrderId || undefined),
        items: cart.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          modifierIds: l.modifierIds,
        })),
      });
    },
    onSuccess: (order) => {
      setPlaced(order);
      setCart([]);
      setIsNewTab(false);
      hadActiveOrderRef.current = true;
      try {
        localStorage.setItem(nameStorageKey, guestName);
        sessionStorage.setItem(nameStorageKey, guestName);
        if (order.id) {
          localStorage.setItem(sessionOrderStorageKey, order.id);
        }
      } catch {}
      queryClient.invalidateQueries({ queryKey: ["public-menu", qrToken] });
      queryClient.invalidateQueries({ queryKey: ["public-status", qrToken] });
    },
  });

  const confirmName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    try {
      localStorage.setItem(nameStorageKey, trimmed);
      sessionStorage.setItem(nameStorageKey, trimmed);
    } catch {}
    setGuestName(trimmed);
  };

  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0);
  const cartTotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const quantityOfItem = (itemId: string) =>
    cart.filter((l) => l.menuItemId === itemId).reduce((sum, l) => sum + l.quantity, 0);

  const addLine = (item: PublicMenuItem, modifierIds: string[], label: string, extra: number) => {
    const key = `${item.id}:${[...modifierIds].sort().join(",")}`;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      return [
        ...prev,
        { key, menuItemId: item.id, modifierIds, label, unitPrice: Number(item.price) + extra, quantity: 1 },
      ];
    });
  };
  const handleAdd = (item: PublicMenuItem) => {
    if (item.modifierGroups.length > 0) setPickerItem(item);
    else addLine(item, [], "", 0);
  };
  const removeOne = (itemId: string) =>
    setCart((prev) => {
      const idx = [...prev].reverse().findIndex((l) => l.menuItemId === itemId);
      if (idx < 0) return prev;
      const at = prev.length - 1 - idx;
      return prev
        .map((l, i) => (i === at ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0);
    });

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <UtensilsCrossed className="h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-medium text-foreground">{t("order.qrNotRecognized")}</p>
        <p className="text-sm text-muted-foreground">
          {error instanceof ApiError ? error.message : t("order.askStaffForHelp")}
        </p>
      </div>
    );
  }

  if (billSettled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {t("order.billPaidTitle")}
        </h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          {t("order.billPaidMessage")}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            setBillSettled(false);
            setPlaced(null);
            setCart([]);
            queryClient.invalidateQueries({ queryKey: ["public-menu", qrToken] });
            queryClient.invalidateQueries({ queryKey: ["public-status", qrToken] });
          }}
        >
          {t("order.startNewOrder")}
        </Button>
      </div>
    );
  }

  if (placed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <div className="relative flex h-10 w-10 items-center justify-center">
          <PopBurst />
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <p className="text-lg font-medium text-foreground">
          {t("order.thankYouName", { name: guestName })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("order.thanksMessage", { branch: data?.branchName ?? t("order.theKitchen") })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("order.orderNumberSent", { number: placed.orderNumber })}
        </p>
        <Button variant="outline" className="mt-2" onClick={() => setPlaced(null)}>
          {t("order.orderMore")}
        </Button>
      </div>
    );
  }

  if (showSharedTableChoice && data?.activeSessions && data.activeSessions.length > 0) {
    const primaryActive = data.activeSessions[0];
    const hostName = primaryActive.guestName || `#${primaryActive.orderNumber}`;
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
        <div className="absolute right-4 top-4">
          <LanguageSwitcher compact />
        </div>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {data.branchName}
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{data.tableName}</p>
        </div>

        <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-card p-5 text-center shadow-sm">
          <p className="text-sm font-semibold text-foreground">
            Table currently occupied by {hostName}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            How would you like to place your order today?
          </p>

          <div className="mt-4 flex flex-col gap-2.5">
            <Button
              className="h-11 w-full gap-2 font-semibold shadow-xs"
              onClick={() => {
                setGuestName(primaryActive.guestName || "");
                try {
                  localStorage.setItem(sessionOrderStorageKey, primaryActive.orderId);
                  if (primaryActive.guestName) {
                    localStorage.setItem(nameStorageKey, primaryActive.guestName);
                  }
                } catch {}
                setShowSharedTableChoice(false);
              }}
            >
              <span>Join Tab ({hostName})</span>
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full border-border/80 font-medium hover:bg-muted"
              onClick={() => {
                setIsNewTab(true);
                setShowSharedTableChoice(false);
                setGuestName("");
                try {
                  localStorage.removeItem(sessionOrderStorageKey);
                } catch {}
              }}
            >
              Start a Separate Bill
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground/80">
            Choose <strong>Separate Bill</strong> if you are sharing this table with another party and need your own bill.
          </p>
        </div>
      </div>
    );
  }

  if (!guestName) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="absolute right-4 top-4">
          <LanguageSwitcher compact />
        </div>
        <UtensilsCrossed className="h-8 w-8 text-primary" />
        {isLoading ? (
          <Skeleton className="h-7 w-40" />
        ) : (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {data?.branchName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data?.tableName}
              {guestName && (
                <span className="font-semibold text-foreground"> · {guestName}</span>
              )}
            </p>
          </div>
        )}
        <form
          className="flex w-full max-w-xs flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            confirmName();
          }}
        >
          <div className="flex flex-col gap-2 text-left">
            <Label htmlFor="guest-name">
              {isNewTab ? "Your Name (Separate Check)" : t("order.whatsYourName")}
            </Label>
            <Input
              id="guest-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder={t("order.namePlaceholder")}
              autoFocus
              maxLength={60}
            />
          </div>
          <Button type="submit" className="h-11" disabled={!nameDraft.trim()}>
            {t("order.continueToMenu")}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background pb-24">
      <header className="border-b border-border px-5 py-6 text-center">
        <div className="absolute right-4 top-4">
          <LanguageSwitcher compact />
        </div>
        {isLoading ? (
          <Skeleton className="mx-auto h-7 w-40" />
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {data?.branchName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data?.tableName}
              {guestName && (
                <span className="font-semibold text-foreground"> · {guestName}</span>
              )}
            </p>
          </>
        )}
      </header>

      {/* Sticky Category Quick Jump Bar */}
      {data && data.categories.length > 0 && (
        <nav
          aria-label="Menu categories"
          className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur-md px-4 py-2.5 shadow-2xs"
        >
          <div className="mx-auto flex max-w-lg items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
            {data.categories.map((category) => {
              const isActive = activeCategoryId === category.id;
              return (
                <button
                  key={category.id}
                  id={`cat-tab-${category.id}`}
                  type="button"
                  onClick={() => scrollToCategory(category.id)}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all duration-300 ease-out whitespace-nowrap cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
                  )}
                >
                  <span>{category.name}</span>
                  <span
                    className={cn(
                      "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums transition-colors duration-300 ease-out",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-background/80 text-muted-foreground"
                    )}
                  >
                    {category.items.length}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-lg px-5 py-6">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {data?.categories.map((category) => (
              <section
                key={category.id}
                id={`cat-${category.id}`}
                className="flex flex-col gap-3 scroll-mt-14"
              >
                <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                  {category.name}
                </h2>
                <div className="flex flex-col gap-3">
                  {category.items.map((item) => {
                    const quantity = quantityOfItem(item.id);
                    return (
                      <div
                        key={item.id}
                        className="flex items-stretch gap-3.5 rounded-2xl border border-border/80 bg-card p-3 shadow-2xs transition-all hover:border-border hover:shadow-xs"
                      >
                        {/* Left: Food Image */}
                        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-muted/60 sm:h-32 sm:w-32">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-muted/40 text-muted-foreground/40">
                              <UtensilsCrossed className="h-8 w-8" />
                            </div>
                          )}
                        </div>

                        {/* Right: Details & Actions */}
                        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                          {/* Top: Dish Name + Veg icon on left, Price aligned on right */}
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 flex-1 items-start gap-1.5">
                                <Leaf
                                  className={cn(
                                    "mt-1 h-3.5 w-3.5 shrink-0",
                                    item.isVeg ? "text-success" : "text-destructive",
                                  )}
                                />
                                <p className="font-semibold text-sm sm:text-base text-foreground leading-snug">
                                  {item.name}
                                </p>
                              </div>
                              <span className="shrink-0 text-right text-sm sm:text-base font-bold tabular-nums text-foreground">
                                {formatCurrency(item.price)}
                              </span>
                            </div>
                            {item.description && (
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-2 pl-5">
                                {item.description}
                              </p>
                            )}
                          </div>

                          {/* Bottom: Wide Add button */}
                          <div className="mt-2.5">
                            {quantity > 0 ? (
                              <div className="flex h-8 w-full items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-2 shadow-2xs">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-primary hover:bg-primary/20"
                                  onClick={() => removeOne(item.id)}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>
                                <span className="text-xs font-bold tabular-nums text-primary">
                                  {quantity} in cart
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-primary hover:bg-primary/20"
                                  onClick={() => handleAdd(item)}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-full gap-1.5 rounded-lg border-primary/25 bg-primary/10 text-xs font-bold text-primary shadow-2xs hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-[0.98] transition-all"
                                onClick={() => handleAdd(item)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                <span>{t("order.add")}</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {status && (status.order || status.openRequests.length > 0 || data) && (
        <section className="mx-auto max-w-lg px-5 pb-6">
          {status.order && (
            <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  Active Tab #{status.order.orderNumber}
                  {status.order.guestName ? ` · ${status.order.guestName}` : ""}
                </p>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  {status.order.status === "BILLED" ? "Bill requested" : "In progress"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {status.order.acceptance === "PENDING"
                  ? "Waiting for the restaurant to confirm"
                  : "Order confirmed with the kitchen"}
              </p>
              <ul className="mt-2.5 flex flex-col gap-1.5 border-t border-border/60 pt-2 text-sm text-muted-foreground">
                {status.order.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 text-xs sm:text-sm">
                    <span className="font-medium text-foreground">
                      {i.quantity} × {i.nameSnapshot}
                    </span>
                    <span className="text-muted-foreground">{ITEM_STATUS_LABEL[i.status] ?? i.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="h-11 flex-1"
              disabled={requestService.isPending || status.openRequests.includes("WAITER")}
              onClick={() => requestService.mutate("WAITER")}
            >
              <BellRing className="mr-2 h-4 w-4" />
              {status.openRequests.includes("WAITER") ? "Waiter is coming" : "Call waiter"}
            </Button>
            {status.order && (
              <Button
                variant="outline"
                className="h-11 flex-1"
                disabled={requestService.isPending || status.openRequests.includes("BILL")}
                onClick={() => requestService.mutate("BILL")}
              >
                <Receipt className="mr-2 h-4 w-4" />
                {status.openRequests.includes("BILL") ? "Bill requested" : "Request bill"}
              </Button>
            )}
          </div>
        </section>
      )}

      <ModifierPickerDialog
        item={pickerItem}
        open={!!pickerItem}
        onOpenChange={(open) => !open && setPickerItem(null)}
        onConfirm={(ids, label) => {
          if (!pickerItem) return;
          const extra = ids.reduce((sum, id) => {
            const m = pickerItem.modifierGroups.flatMap((g) => g.modifierGroup.modifiers).find((x) => x.id === id);
            return sum + (m ? Number(m.priceAdjustment) : 0);
          }, 0);
          addLine(pickerItem, ids, label, extra);
        }}
      />

      <footer className="border-t border-border px-5 py-6 text-center text-xs text-muted-foreground">
        {t("order.pricesIncludeTax")}
      </footer>

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background px-5 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <Button
              className="h-12 flex-1"
              disabled={placeOrder.isPending}
              onClick={() => placeOrder.mutate()}
            >
              {placeOrder.isPending
                ? t("order.placingOrder")
                : `${t("order.placeOrder")} — ${cartCount} ${cartCount > 1 ? t("order.items") : t("order.item")} · ${formatCurrency(cartTotal)}`}
            </Button>
          </div>
          {placeOrder.isError && (
            <p className="mx-auto mt-2 max-w-lg text-center text-xs text-destructive">
              {placeOrder.error instanceof ApiError
                ? placeOrder.error.message
                : t("order.couldNotPlace")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
