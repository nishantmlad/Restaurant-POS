"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, Clock, QrCode, RefreshCw, Zap } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { kioskApi, type KioskMenu, type KioskPaymentSession } from "@/lib/kiosk-api";
import type { KioskConfirmation, ServiceType } from "@/lib/kiosk-flow";
import { KButton } from "./kiosk-ui";

export function KioskPaymentScreen({
  token,
  menu,
  session,
  serviceType,
  serviceLabel,
  fmt,
  onPaymentVerified,
  onManualPaid,
  onCancel,
}: {
  token: string;
  menu: KioskMenu;
  session: KioskPaymentSession;
  serviceType: ServiceType;
  serviceLabel: string;
  fmt: (n: number | string) => string;
  onPaymentVerified: (confirmation: KioskConfirmation) => void;
  onManualPaid: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(10, Math.floor((session.expiresAt - Date.now()) / 1000)),
  );
  const [isExpired, setIsExpired] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const verifiedRef = useRef(false);

  // 1. Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) {
      setIsExpired(true);
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setIsExpired(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  // 2. Poll backend for bank verification when gateway session is active
  useEffect(() => {
    if (isExpired || verifiedRef.current || !session.gatewayEnabled) return;

    let active = true;
    const checkStatus = async () => {
      try {
        const res = await kioskApi.paymentStatus(token, session.paymentId);
        if (!active || verifiedRef.current) return;

        if (res.status === "PAID" && res.confirmation) {
          verifiedRef.current = true;
          onPaymentVerified({
            ...res.confirmation,
            serviceType,
            paid: true,
          });
        } else if (res.status === "EXPIRED") {
          setIsExpired(true);
        }
      } catch (err) {
        // Transient network hiccups are ignored while polling
      }
    };

    const interval = setInterval(checkStatus, 2500);
    void checkStatus();

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [token, session.paymentId, session.gatewayEnabled, isExpired, onPaymentVerified, serviceType]);

  // 3. Developer test mode simulation
  const handleSimulate = async () => {
    if (isSimulating || verifiedRef.current) return;
    setIsSimulating(true);
    setErrorMessage(null);
    try {
      const res = await kioskApi.simulatePayment(token, session.paymentId);
      if (res.confirmation) {
        verifiedRef.current = true;
        onPaymentVerified({
          ...res.confirmation,
          serviceType,
          paid: true,
        });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to simulate payment");
      setIsSimulating(false);
    }
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top Bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/40 transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Cancel &amp; Change Payment</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-secondary px-3.5 py-1 text-sm font-bold text-foreground">
            {serviceLabel}
          </span>
          <span className="text-sm font-bold text-muted-foreground">
            Order Total: <strong className="text-foreground text-base">{fmt(session.amount)}</strong>
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center overflow-y-auto">
        <div className="flex w-full max-w-xl flex-col items-center gap-6 rounded-3xl border-2 border-border bg-card p-8 shadow-xl">
          {isExpired ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <AlertCircle className="h-16 w-16 text-warning" />
              <h2 className="text-2xl font-bold text-foreground">Payment Session Expired</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                The payment time window has elapsed. No money has been deducted from your account.
              </p>
              <div className="flex gap-3 pt-2">
                <KButton onClick={onCancel} large>
                  Try Again / Pay at Counter
                </KButton>
              </div>
            </div>
          ) : (
            <>
              {/* Header Title */}
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                  Scan QR to Pay
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Scan with Google Pay, PhonePe, Paytm, BHIM, or any UPI banking app
                </p>
              </div>

              {/* QR Code Container */}
              <div className="relative rounded-3xl border-4 border-primary/20 bg-white p-6 shadow-md transition-all hover:border-primary/40">
                <QRCodeSVG
                  value={session.upiUri}
                  size={240}
                  level="M"
                  marginSize={1}
                />
                <div className="mt-3 flex items-center justify-center gap-2 font-mono text-sm font-bold text-slate-800">
                  <QrCode className="h-4 w-4 text-primary" />
                  <span>Exact Amount: {fmt(session.amount)}</span>
                </div>
              </div>

              {/* Live Bank Verification Listening Status OR Manual Paid Confirmation */}
              {session.gatewayEnabled ? (
                <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-3 text-primary">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                  </span>
                  <span className="text-sm font-semibold">
                    Waiting for payment confirmation from bank...
                  </span>
                </div>
              ) : (
                <div className="w-full flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={onManualPaid}
                    className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] py-4 px-6 font-bold text-white text-base shadow-lg transition cursor-pointer"
                  >
                    <CheckCircle2 className="h-6 w-6" />
                    <span>I have completed the payment</span>
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Click after completing payment in your UPI app
                  </p>
                </div>
              )}

              {/* Countdown Timer & Extend */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 font-medium tabular-nums">
                  <Clock className="h-4 w-4" />
                  <span>Expires in: <strong>{timeFormatted}</strong></span>
                </div>
                {secondsLeft < 60 && (
                  <button
                    type="button"
                    onClick={() => setSecondsLeft((s) => s + 45)}
                    className="font-bold text-primary underline hover:opacity-80 transition cursor-pointer"
                  >
                    +45s Need more time
                  </button>
                )}
              </div>

              {/* Test Mode Simulation Card */}
              {session.isTestMode && (
                <div className="w-full rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-500/10 p-4 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wide">
                      <Zap className="h-4 w-4" />
                      <span>Developer Test Mode Active</span>
                    </div>
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      Razorpay Sandbox
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click below to test the instant bank confirmation flow without scanning with a real app:
                  </p>
                  <button
                    type="button"
                    disabled={isSimulating}
                    onClick={handleSimulate}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] py-3 px-4 font-bold text-white text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSimulating ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    <span>⚡ Simulate Bank Payment Success (Dev Test)</span>
                  </button>
                  {errorMessage && (
                    <p className="mt-2 text-xs font-semibold text-destructive">{errorMessage}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
