"use client";

import { ArrowLeft, CheckCircle2, PartyPopper, Printer, QrCode, RefreshCw, Sparkles, Store, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import type { KioskMenu } from "@/lib/kiosk-api";
import { basketCount, basketTotal, type BasketLine } from "@/lib/kiosk-basket";
import type { KioskConfirmation, SubmitState } from "@/lib/kiosk-flow";
import { cn } from "@/lib/utils";
import { BasketLines } from "./basket-lines";
import { Banner, KButton } from "./kiosk-ui";
import { printKioskReceipt } from "./kiosk-print";
import { CelebrationConfetti } from "./celebration";

function sanitizeTaxLabel(label?: string | null): string {
  if (!label) return "tax";
  const trimmed = label.trim();
  if (/^[0-9A-Z]{9,}$/i.test(trimmed) || trimmed.length > 15) {
    return "GST";
  }
  return trimmed;
}

export function ReviewScreen({
  menu,
  basket,
  submit,
  locked,
  online,
  fmt,
  header,
  serviceLabel,
  paymentMethod,
  onSelectPaymentMethod,
  onChange,
  onBack,
  onConfirm,
  onStartOver,
}: {
  menu: KioskMenu;
  basket: BasketLine[];
  submit: SubmitState;
  locked: boolean;
  online: boolean;
  fmt: (n: number) => string;
  header: React.ReactNode;
  serviceLabel: string;
  paymentMethod: "COUNTER" | "UPI";
  onSelectPaymentMethod: (method: "COUNTER" | "UPI") => void;
  onChange: (key: string, delta: number) => void;
  onBack: () => void;
  onConfirm: () => void;
  onStartOver: () => void;
}) {
  const { t } = useI18n();
  const pending = submit.status === "pending";
  const failed = submit.status === "error" ? submit.kind : null;
  const ambiguous = failed === "network" || failed === "server";
  const cleanTax = sanitizeTaxLabel(menu.taxLabel);
  const taxText =
    menu.taxMode === "INCLUSIVE"
      ? t("kiosk.review.taxIncluded", { tax: cleanTax })
      : t("kiosk.review.taxAdded", { tax: cleanTax });

  return (
    <div className="flex h-full flex-col">
      {header}
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row lg:gap-6 lg:p-6">
        <section className="flex min-h-0 flex-1 flex-col rounded-3xl border-2 border-border bg-card">
          <h1 className="flex items-center justify-between gap-3 border-b border-border p-5 text-[1.9rem] font-bold">
            {t("kiosk.review.title")}
            <span className="rounded-full bg-secondary px-4 py-1 text-[1.1rem] font-semibold">{serviceLabel}</span>
          </h1>
          <div className="min-h-0 flex-1 overflow-y-auto px-5">
            <BasketLines lines={basket} fmt={fmt} locked={locked} onChange={onChange} />
          </div>
        </section>

        <section className="flex shrink-0 flex-col justify-between gap-4 rounded-3xl border-2 border-border bg-card p-5 lg:w-[26rem]">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between text-[2rem] font-bold">
              <span>{t("kiosk.basket.total")}</span>
              <span className="tabular-nums">{fmt(basketTotal(basket))}</span>
            </div>
            <p className="text-[1rem] text-muted-foreground">
              {basketCount(basket) === 1 ? t("kiosk.basket.item") : t("kiosk.basket.items", { count: basketCount(basket) })}
              {" · "}
              {taxText}
            </p>

            {/* Payment Method Selector */}
            <div className="pt-2 flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Payment Option
              </span>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => onSelectPaymentMethod("COUNTER")}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition select-none",
                    paymentMethod === "COUNTER"
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border bg-background hover:bg-muted/30"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      paymentMethod === "COUNTER" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Store className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-foreground">Pay at Counter</p>
                    <p className="text-xs text-muted-foreground">Cash, Card, or UPI at cashier</p>
                  </div>
                </button>

                {menu.upiVpa && (
                  <button
                    type="button"
                    onClick={() => onSelectPaymentMethod("UPI")}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition select-none",
                      paymentMethod === "UPI"
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border bg-background hover:bg-muted/30"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        paymentMethod === "UPI" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <QrCode className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-foreground">Pay via UPI QR</p>
                      <p className="text-xs text-muted-foreground">Scan with GPay, PhonePe, Paytm</p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {!online && (
              <Banner tone="error" title={t("kiosk.offline.title")}>
                {t("kiosk.offline.body")}
              </Banner>
            )}
            {failed && (
              <Banner tone="error" title={t(`kiosk.err.${failed}.title`)}>
                {failed === "validation" && submit.status === "error" && submit.message
                  ? `${t("kiosk.err.validation.body")} (${submit.message})`
                  : t(`kiosk.err.${failed}.body`)}
              </Banner>
            )}

            <KButton
              large
              className="w-full"
              loading={pending}
              disabled={!online || basket.length === 0}
              onClick={onConfirm}
            >
              {pending ? (
                t("kiosk.review.sending")
              ) : ambiguous ? (
                <>
                  <RefreshCw className="h-6 w-6" aria-hidden />
                  {t("kiosk.review.retry")}
                </>
              ) : paymentMethod === "UPI" ? (
                "Proceed to UPI Payment →"
              ) : (
                t("kiosk.review.confirm")
              )}
            </KButton>
            {ambiguous ? (
              <KButton variant="secondary" className="w-full" disabled={pending} onClick={onStartOver}>
                {t("kiosk.review.startOver")}
              </KButton>
            ) : (
              <KButton variant="secondary" className="w-full" disabled={pending} onClick={onBack}>
                <ArrowLeft className="h-5 w-5" aria-hidden />
                {t("kiosk.review.back")}
              </KButton>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function DoneScreen({
  token,
  menu,
  confirmation,
  secondsLeft,
  fmt,
  localeTag,
  online,
  paymentMethod = "COUNTER",
  onExtendTimer,
  onNewOrder,
}: {
  token?: string;
  menu: KioskMenu;
  confirmation: KioskConfirmation;
  secondsLeft: number;
  fmt: (n: number | string) => string;
  localeTag: string;
  online: boolean;
  paymentMethod?: "COUNTER" | "UPI";
  onExtendTimer?: () => void;
  onNewOrder: () => void;
}) {
  const { t } = useI18n();
  const [printState, setPrintState] = useState<"idle" | "printing" | "unavailable">("idle");

  const print = async () => {
    if (!token || !confirmation?.orderNumber) {
      setPrintState("unavailable");
      return;
    }
    setPrintState("printing");
    const ok = await printKioskReceipt(token, confirmation.orderNumber);
    setPrintState(ok ? "idle" : "unavailable");
  };

  const tokenNumber = confirmation?.dailyToken != null
    ? String(confirmation.dailyToken).padStart(2, "0")
    : confirmation?.orderNumber
      ? confirmation.orderNumber.split("-").pop()
      : "----";
  const orderNumFull = confirmation?.orderNumber || "----";
  const totalDisplay = fmt(confirmation?.totalAmount ?? 0);

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-5 overflow-y-auto px-8 py-6 text-center">
      {/* Celebration Confetti Burst */}
      <CelebrationConfetti />

      {/* Animated Success Badge */}
      <div className="relative flex items-center justify-center">
        <span className="absolute inline-flex h-24 w-24 animate-ping rounded-full bg-emerald-400 opacity-25" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-md">
          <CheckCircle2 className="h-12 w-12" aria-hidden />
        </div>
      </div>

      <h1 className="text-[2.75rem] font-extrabold tracking-tight text-foreground">{t("kiosk.done.title")}</h1>

      <div role="status" aria-live="polite" className="space-y-1">
        <p className="text-[1.35rem] font-bold text-muted-foreground uppercase tracking-wider">
          Token Number
        </p>
        <div className="flex items-center justify-center gap-3">
          <Sparkles className="h-8 w-8 text-amber-500 animate-pulse" aria-hidden />
          <p
            data-testid="order-number"
            className="text-[5.5rem] font-extrabold leading-none tracking-tight text-primary tabular-nums"
          >
            {tokenNumber}
          </p>
          <Sparkles className="h-8 w-8 text-amber-500 animate-pulse" aria-hidden />
        </div>
        <p className="mt-1 font-mono text-[1.05rem] text-muted-foreground tracking-wide tabular-nums">
          Order: {orderNumFull}
        </p>
      </div>

      {confirmation?.paid || paymentMethod === "UPI" ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-emerald-500/30 bg-emerald-500/10 p-5 max-w-sm w-full mx-auto shadow-sm text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2 font-bold text-lg text-emerald-700 dark:text-emerald-400">
            <PartyPopper className="h-5 w-5 text-amber-500 animate-bounce" />
            <span>Payment Successful!</span>
            <PartyPopper className="h-5 w-5 text-amber-500 animate-bounce" />
          </div>
          <p className="text-sm text-muted-foreground">
            {totalDisplay} received. Your order has been sent straight to the kitchen.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-[1.35rem] font-semibold">{t("kiosk.done.pay")}</p>
          <p className="text-[1.15rem] tabular-nums text-muted-foreground">
            {t("kiosk.basket.total")}: <strong className="text-foreground">{totalDisplay}</strong>
          </p>
        </div>
      )}

      {printState === "unavailable" && (
        <div className="w-full max-w-[40rem]">
          <Banner tone="warning" title={t("kiosk.done.printUnavailable")} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-4">
        <KButton large onClick={onNewOrder} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
          <CheckCircle2 className="h-6 w-6 mr-1" />
          Done / New order
        </KButton>
        <KButton variant="secondary" large loading={printState === "printing"} onClick={print}>
          <Printer className="h-6 w-6" aria-hidden />
          {t("kiosk.done.print")}
        </KButton>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground">
        <p className="text-[1.1rem] tabular-nums" aria-live="off">
          {t("kiosk.done.autoReturn", { seconds: secondsLeft })}
        </p>
        {onExtendTimer && secondsLeft < 45 && (
          <button
            type="button"
            onClick={onExtendTimer}
            className="text-xs font-bold text-primary underline hover:opacity-80 py-1 px-2 rounded-md hover:bg-primary/10 transition"
          >
            +30s Need more time
          </button>
        )}
      </div>
      {!online && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <WifiOff className="h-5 w-5" aria-hidden /> {t("kiosk.offline.title")}
        </div>
      )}
    </div>
  );
}
