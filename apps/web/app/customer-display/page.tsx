"use client";

import { useEffect, useState } from "react";
import {
  subscribeDisplay,
  requestDisplaySync,
  type DisplayState,
} from "@/lib/customer-display";
import { formatCurrency } from "@/lib/format";
import { playPaymentReceived } from "@/lib/celebrate";
import { useOptionalBranch } from "@/hooks/use-branch";
import { useSettings } from "@/hooks/use-settings";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Maximize2,
  Minimize2,
  QrCode,
  ShoppingBag,
  Sparkles,
  Store,
  Tv,
  UtensilsCrossed,
  Volume2,
  VolumeX,
} from "lucide-react";

function normalizeUploadUrl(url?: string | null): string {
  if (!url) return "/api/uploads/53bf505d-f1f9-4be8-8c9d-ea3e6b46615a.png";
  if (url.startsWith("/uploads/")) return `/api${url}`;
  return url;
}

/**
 * Customer-Facing Second Screen / Customer Display System (CDS).
 * Mirrors live order lines, UPI QR payment codes, and payment confirmations
 * directly to the customer at the counter.
 */
export default function CustomerDisplayPage() {
  const [state, setState] = useState<DisplayState>({ kind: "idle" });
  const [soundOn, setSoundOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [logoError, setLogoError] = useState(false);

  const branchCtx = useOptionalBranch();
  const branchId =
    branchCtx?.branchId ??
    (typeof window !== "undefined" ? localStorage.getItem("nodedr_branch_id") : null);
  const { data: settings } = useSettings(branchId);
  const restaurantName = settings?.restaurant?.name || "G nine";
  const rawLogo =
    settings?.restaurant?.logoUrl ||
    "/api/uploads/53bf505d-f1f9-4be8-8c9d-ea3e6b46615a.png";
  const logoUrl = normalizeUploadUrl(rawLogo);
  const branchName =
    settings?.branch?.name ||
    branchCtx?.branches.find((b) => b.id === branchId)?.name ||
    "Vesu Branch";

  // Subscribe to live BroadcastChannel from POS & ask for active cart state on mount
  useEffect(() => {
    const unsub = subscribeDisplay(setState);
    requestDisplaySync();
    return () => unsub();
  }, []);

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
      setCurrentDate(
        now.toLocaleDateString([], {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Chime when payment lands
  useEffect(() => {
    if (state.kind === "paid" && soundOn) {
      playPaymentReceived(formatCurrency(state.total));
    }
  }, [state, soundOn]);

  // After "paid", fall back to the welcome screen for the next guest
  useEffect(() => {
    if (state.kind !== "paid") return;
    const t = setTimeout(() => setState({ kind: "idle" }), 8000);
    return () => clearTimeout(t);
  }, [state]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen flex-col bg-slate-50 text-foreground dark:bg-zinc-950 select-none overflow-hidden"
      onClick={() => {
        if (!soundOn) setSoundOn(true);
      }}
    >
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-border/80 bg-background/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-white p-1 shadow-xs">
            {!logoError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={restaurantName}
                className="h-full w-full object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <Store className="h-6 w-6 text-primary" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              {restaurantName}
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {branchName}
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">Order &amp; Customer Display</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live Clock */}
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>{currentDate}</span>
            <span className="font-semibold text-foreground">{currentTime}</span>
          </div>

          {/* Sound Armed Indicator */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSoundOn((v) => !v);
            }}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              soundOn
                ? "border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "border-border/80 bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
            title="Click to toggle payment sound"
          >
            {soundOn ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Audio Active</span>
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 opacity-60" />
                <span>Tap for Sound</span>
              </>
            )}
          </button>

          {/* Switch to TV Queue Order Status */}
          <a
            href={branchId ? `/order-status?branchId=${branchId}` : "/order-status"}
            className="hidden md:flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Switch to TV Order Status Board"
          >
            <Tv className="h-3.5 w-3.5 text-primary" />
            <span>TV Queue Board</span>
          </a>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Toggle fullscreen mode"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex flex-1 flex-col p-6 sm:p-10 justify-center">
        {/* 1. IDLE / WELCOME STATE */}
        {state.kind === "idle" && (
          <div className="m-auto flex w-full max-w-2xl flex-col items-center text-center">
            {/* Logo Emblem */}
            <div className="relative mb-6">
              <div className="flex h-28 w-28 items-center justify-center rounded-3xl border border-border/80 bg-white p-3 shadow-xl ring-8 ring-primary/5 overflow-hidden">
                {!logoError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={restaurantName}
                    className="h-full w-full object-contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <UtensilsCrossed className="h-12 w-12 text-primary" />
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>

            <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
              Welcome to {restaurantName}
            </h2>
            <p className="mt-3 text-lg text-muted-foreground font-medium">
              Freshly Prepared Delicacies &middot; Pure Ingredients &middot; Exceptional Taste
            </p>

            <div className="mt-8 flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary shadow-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary"></span>
              </span>
              <span>Ready for your order at the counter</span>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Your order and bill details will appear here as the cashier rings them up.
            </p>

            {/* Bottom Hospitality Badges */}
            <div className="mt-12 grid grid-cols-3 gap-4 w-full border-t border-border/70 pt-6">
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border border-border/60">
                <UtensilsCrossed className="h-5 w-5 text-primary" />
                <span className="text-xs font-semibold text-foreground">100% Quality Food</span>
                <span className="text-[11px] text-muted-foreground">Cooked Fresh</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border border-border/60">
                <QrCode className="h-5 w-5 text-primary" />
                <span className="text-xs font-semibold text-foreground">UPI &amp; Cards</span>
                <span className="text-[11px] text-muted-foreground">Instant Payment</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border border-border/60">
                <Store className="h-5 w-5 text-primary" />
                <span className="text-xs font-semibold text-foreground">Dine-in &amp; Takeaway</span>
                <span className="text-[11px] text-muted-foreground">{branchName}</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. LIVE CART STATE */}
        {state.kind === "cart" && (
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 lg:flex-row">
            {/* Left: Items List */}
            <div className="flex flex-1 flex-col rounded-3xl border border-border bg-card p-6 shadow-sm overflow-hidden">
              <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    Your Order
                  </h3>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-foreground">
                  {state.lines.reduce((n, l) => n + l.quantity, 0)}{" "}
                  {state.lines.reduce((n, l) => n + l.quantity, 0) === 1
                    ? "item"
                    : "items"}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-border/60 pr-2">
                {state.lines.map((l, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-4 py-3.5 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-black text-primary">
                        {l.quantity}×
                      </span>
                      <span className="text-lg font-semibold text-foreground truncate">
                        {l.name}
                      </span>
                    </div>
                    <span className="text-lg font-bold tabular-nums text-foreground shrink-0">
                      {formatCurrency(l.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Bill Summary */}
            <div className="flex w-full lg:w-96 flex-col justify-between rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/5 via-card to-card p-6 shadow-md">
              <div>
                <span className="text-xs font-bold tracking-wider uppercase text-primary">
                  Bill Summary
                </span>
                <div className="mt-4 flex items-baseline justify-between border-b border-border/60 pb-3 text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatCurrency(state.subtotal)}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between text-xs text-muted-foreground">
                  <span>Taxes &amp; GST</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Included
                  </span>
                </div>
              </div>

              <div className="mt-8 rounded-2xl bg-primary/10 p-5 border border-primary/20">
                <span className="text-xs font-semibold text-primary block mb-1">
                  Total Payable
                </span>
                <span className="text-4xl sm:text-5xl font-black tabular-nums tracking-tight text-primary">
                  {formatCurrency(state.subtotal)}
                </span>
                <p className="mt-2 text-xs text-muted-foreground">
                  Cashier is ringing up your bill &middot; UPI &amp; Cards accepted
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3. UPI QR PAYMENT STATE */}
        {state.kind === "upi" && (
          <div className="m-auto flex w-full max-w-lg flex-col items-center rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
            <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
              <QrCode className="h-4 w-4" />
              <span>Instant UPI Payment</span>
            </div>

            <p className="mt-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Amount Due
            </p>
            <p className="mt-1 text-5xl font-black tabular-nums tracking-tight text-foreground">
              {formatCurrency(state.total)}
            </p>

            {/* High-visibility QR Card */}
            <div className="mt-6 rounded-3xl bg-white p-5 shadow-lg border border-border/60">
              <QRCodeSVG value={state.uri} size={280} level="M" marginSize={1} />
            </div>

            <p className="mt-5 text-sm font-semibold text-foreground">
              Scan with any UPI App
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Google Pay &middot; PhonePe &middot; Paytm &middot; BHIM &middot; Cred
            </p>

            {state.payee && (
              <div className="mt-4 rounded-xl bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
                Payee: <span className="font-semibold text-foreground">{state.payee}</span>
              </div>
            )}
          </div>
        )}

        {/* 4. PAYMENT SUCCESS STATE */}
        {state.kind === "paid" && (
          <div className="m-auto flex w-full max-w-md flex-col items-center rounded-3xl border border-emerald-500/30 bg-card p-10 text-center shadow-2xl">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-8 ring-emerald-500/5 dark:bg-emerald-500/20 dark:text-emerald-400">
              <CheckCircle2 className="h-12 w-12" />
            </div>

            <h3 className="mt-6 text-3xl font-black tracking-tight text-foreground">
              Payment Successful!
            </h3>
            <p className="mt-2 text-4xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(state.total)}
            </p>
            {state.method && (
              <span className="mt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Paid via {state.method}
              </span>
            )}

            <div className="mt-6 w-full border-t border-border/80 pt-5">
              <p className="text-base font-semibold text-foreground">
                Thank you for dining with {restaurantName}!
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your order has been sent to the kitchen. Please collect your bill token.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Footer Note */}
      <footer className="relative z-10 border-t border-border/60 bg-background/50 py-2.5 px-6 text-center text-[11px] text-muted-foreground">
        <span>{restaurantName} &middot; {branchName}</span>
      </footer>
    </div>
  );
}
