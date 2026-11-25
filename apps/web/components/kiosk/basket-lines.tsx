"use client";

import { Minus, Plus, Trash2, Utensils } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import type { BasketLine } from "@/lib/kiosk-basket";
import { IconButton } from "./kiosk-ui";

/** Basket rows with quantity steppers; `locked` freezes edits (submit in flight / outcome unknown). */
export function BasketLines({
  lines,
  fmt,
  locked,
  onChange,
  compact = false,
}: {
  lines: BasketLine[];
  fmt: (n: number) => string;
  locked: boolean;
  onChange: (key: string, delta: number) => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <ul className="flex flex-col divide-y divide-border">
      {lines.map((l) => {
        const lineTotal = Math.round(l.unitPrice * l.quantity * 100) / 100;

        if (compact) {
          return (
            <li key={l.key} className="flex items-center gap-3 py-2.5">
              {l.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={l.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-12 w-12 rounded-xl object-cover border border-border/60 shrink-0 shadow-2xs"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/40 border border-border/50 text-muted-foreground shrink-0">
                  <Utensils className="h-4 w-4 opacity-30" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] font-semibold leading-tight text-foreground line-clamp-1" title={l.name}>
                  {l.name}
                </p>
                {l.modifierLabel && (
                  <p className="text-[0.8rem] leading-tight text-muted-foreground mt-0.5 line-clamp-1">
                    {l.modifierLabel}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={l.quantity === 1 ? t("kiosk.basket.remove", { name: l.name }) : t("kiosk.basket.less", { name: l.name })}
                    disabled={locked}
                    onClick={() => onChange(l.key, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-secondary active:scale-95 transition disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    {l.quantity === 1 ? <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden /> : <Minus className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                  <span className="min-w-[1.25rem] text-center text-xs font-bold tabular-nums" aria-live="polite">
                    {l.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={t("kiosk.basket.more", { name: l.name })}
                    disabled={locked}
                    onClick={() => onChange(l.key, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-secondary active:scale-95 transition disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="shrink-0 text-right self-center pl-1">
                <p className="text-[1.05rem] font-bold tabular-nums text-foreground">
                  {fmt(lineTotal)}
                </p>
                {l.quantity > 1 && (
                  <p className="text-[0.7rem] text-muted-foreground tabular-nums mt-0.5">
                    {fmt(l.unitPrice)} ea
                  </p>
                )}
              </div>
            </li>
          );
        }

        return (
          <li key={l.key} className="flex items-center gap-4 py-3.5">
            {l.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={l.imageUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-16 w-16 rounded-2xl object-cover border border-border/60 shrink-0 shadow-xs"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/40 border border-border/50 text-muted-foreground shrink-0">
                <Utensils className="h-6 w-6 opacity-30" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[1.15rem] font-semibold leading-snug">{l.name}</p>
              {l.modifierLabel && (
                <p className="text-[0.95rem] leading-snug text-muted-foreground">{l.modifierLabel}</p>
              )}
              <p className="text-[1rem] tabular-nums text-muted-foreground">{fmt(l.unitPrice)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <IconButton
                label={l.quantity === 1 ? t("kiosk.basket.remove", { name: l.name }) : t("kiosk.basket.less", { name: l.name })}
                disabled={locked}
                onClick={() => onChange(l.key, -1)}
              >
                {l.quantity === 1 ? <Trash2 className="h-5 w-5" aria-hidden /> : <Minus className="h-5 w-5" aria-hidden />}
              </IconButton>
              <span className="w-8 text-center text-[1.35rem] font-bold tabular-nums" aria-live="polite">
                {l.quantity}
              </span>
              <IconButton label={t("kiosk.basket.more", { name: l.name })} disabled={locked} onClick={() => onChange(l.key, 1)}>
                <Plus className="h-5 w-5" aria-hidden />
              </IconButton>
            </div>
            <p className="w-[5.5rem] shrink-0 text-right text-[1.15rem] font-bold tabular-nums">
              {fmt(lineTotal)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
