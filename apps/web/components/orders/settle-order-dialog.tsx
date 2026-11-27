"use client";

import { useEffect, useState } from "react";
import { Banknote, CheckCircle2, CreditCard, DollarSign, Printer, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCheckoutOrder } from "@/hooks/use-orders";
import { useSettings } from "@/hooks/use-settings";
import { formatCurrency } from "@/lib/format";
import { openReceiptPrint } from "@/lib/print";
import { playPaymentReceived } from "@/lib/celebrate";
import { buildUpiUri } from "@/lib/upi";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PaymentMethodDto } from "@nodedr-restaurant/types";

interface SettleOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string | null;
  order: {
    id: string;
    orderNumber: string;
    totalAmount: number | string;
    type?: string;
    channel?: string;
  } | null;
  onSettled?: () => void;
}

const METHODS: { key: PaymentMethodDto; label: string; icon: typeof Banknote }[] = [
  { key: "CASH", label: "Cash", icon: Banknote },
  { key: "UPI", label: "UPI QR", icon: QrCode },
  { key: "CARD", label: "Card", icon: CreditCard },
  { key: "OTHER", label: "Other", icon: DollarSign },
];

export function SettleOrderDialog({
  open,
  onOpenChange,
  branchId,
  order,
  onSettled,
}: SettleOrderDialogProps) {
  const [method, setMethod] = useState<PaymentMethodDto>("CASH");
  const [tenderedStr, setTenderedStr] = useState<string>("");
  const [printAfter, setPrintAfter] = useState(true);

  // Reset payment method and cash tendered whenever a new order is opened or dialog toggled
  useEffect(() => {
    if (open && order) {
      setMethod("CASH");
      setTenderedStr("");
    }
  }, [open, order?.id]);

  const checkout = useCheckoutOrder(branchId);
  const { data: settings } = useSettings(branchId);

  if (!order) return null;

  const total = Number(order.totalAmount || 0);
  const tendered = parseFloat(tenderedStr) || total;
  const changeDue = Math.max(0, tendered - total);

  const payeeVpa = settings?.restaurant.upiVpa;
  const payeeName = settings?.restaurant.upiPayeeName || settings?.restaurant.name || "Restaurant";
  const upiUri =
    method === "UPI" && payeeVpa && total > 0
      ? buildUpiUri({
          vpa: payeeVpa,
          name: payeeName,
          amount: total,
          note: `Order #${order.orderNumber}`,
          ref: order.id,
        })
      : null;

  const handleSettle = async () => {
    if (!branchId || !order) return;
    try {
      await checkout.mutateAsync({
        orderId: order.id,
        dto: {
          payments: [
            {
              method,
              amount: total,
              tendered: method === "CASH" ? Math.max(total, tendered) : undefined,
            },
          ],
        },
      });

      playPaymentReceived();
      toast.success(`Order #${order.orderNumber} settled successfully!`);

      if (printAfter) {
        openReceiptPrint(order.id, branchId);
      }

      onOpenChange(false);
      setTenderedStr("");
      setMethod("CASH");
      onSettled?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to settle order");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-lg font-bold">
            <span>Settle Order #{order.orderNumber}</span>
            <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-sm font-black text-primary">
              {formatCurrency(total)}
            </span>
          </DialogTitle>
          <DialogDescription>
            {order.type || "TAKEOUT"} · {order.channel || "Counter"} — Collect payment to mark this order settled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Method selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Payment Method</Label>
            <div className="grid grid-cols-4 gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMethod(m.key)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition-all",
                      active
                        ? "border-primary bg-primary/10 text-primary shadow-xs"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary/50",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cash details */}
          {method === "CASH" && (
            <div className="rounded-xl border border-border/80 bg-secondary/15 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="tendered-input" className="text-xs font-medium">Cash Tendered</Label>
                <span className="text-xs text-muted-foreground">Exact: {formatCurrency(total)}</span>
              </div>
              <Input
                id="tendered-input"
                type="number"
                placeholder={String(total)}
                value={tenderedStr}
                onChange={(e) => setTenderedStr(e.target.value)}
                className="h-10 text-base font-bold"
                autoFocus
              />
              {changeDue > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span>Change to Return:</span>
                  <span className="text-sm font-extrabold">{formatCurrency(changeDue)}</span>
                </div>
              )}
            </div>
          )}

          {/* UPI QR Display */}
          {method === "UPI" && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border/80 bg-secondary/15 p-4 text-center">
              {upiUri ? (
                <>
                  <div className="rounded-xl bg-white p-2.5 shadow-sm">
                    <QRCodeSVG value={upiUri} size={150} level="M" />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    Scan with any UPI App (GPay, PhonePe, Paytm)
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    UPI: {payeeVpa}
                  </p>
                </>
              ) : (
                <div className="py-2 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">UPI Payee not configured</p>
                  <p className="mt-0.5 text-[11px]">You can still confirm UPI payment received directly.</p>
                </div>
              )}
            </div>
          )}

          {/* Card / Other notice */}
          {(method === "CARD" || method === "OTHER") && (
            <div className="rounded-xl border border-border/80 bg-secondary/15 p-3 text-center text-xs text-muted-foreground">
              Collect {formatCurrency(total)} via Card POS Terminal / Payment machine, then tap Confirm.
            </div>
          )}

          {/* Print receipt toggle */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={printAfter}
              onChange={(e) => setPrintAfter(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <Printer className="h-3.5 w-3.5" />
            <span>Print tax receipt immediately upon settlement</span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={checkout.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSettle}
            disabled={checkout.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            {checkout.isPending ? "Settling…" : `Confirm Payment (${formatCurrency(total)})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
