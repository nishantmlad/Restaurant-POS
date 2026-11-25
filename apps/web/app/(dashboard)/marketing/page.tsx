"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranch } from "@/hooks/use-branch";
import {
  useAudience,
  useCampaigns,
  useCoupons,
  useMarketingActions,
  usePromotions,
} from "@/hooks/use-marketing";
import { ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong");
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TABS = ["coupons", "happy hour", "campaigns"] as const;
type Tab = (typeof TABS)[number];
const discountText = (kind: string, value: string) => (kind === "PERCENT" ? `${Number(value)}% off` : `${formatCurrency(value)} off`);

function Coupons({ branchId }: { branchId: string | null }) {
  const { data, isLoading } = useCoupons(branchId);
  const { createCoupon, couponActive, deleteCoupon } = useMarketingActions(branchId);
  const confirm = useConfirm();
  const [f, setF] = useState({ code: "", kind: "PERCENT", value: "", minOrderAmount: "", usageLimit: "" });
  const [errors, setErrors] = useState<{ code?: string; value?: string }>({});

  const validate = () => {
    const errs: typeof errors = {};
    if (!f.code.trim()) {
      errs.code = "Coupon code is required";
    } else if (f.code.trim().length < 3) {
      errs.code = "Coupon code must be at least 3 characters";
    }
    if (!f.value || isNaN(Number(f.value)) || Number(f.value) <= 0) {
      errs.value = "Enter a valid positive value";
    }
    return errs;
  };

  const submit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error(Object.values(errs)[0]);
      return;
    }
    setErrors({});
    createCoupon.mutate(
      {
        code: f.code.trim().toUpperCase(),
        kind: f.kind,
        value: Number(f.value),
        minOrderAmount: f.minOrderAmount ? Number(f.minOrderAmount) : 0,
        usageLimit: f.usageLimit ? Number(f.usageLimit) : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Coupon created");
          setF({ ...f, code: "", value: "", minOrderAmount: "", usageLimit: "" });
          setErrors({});
        },
        onError: (e) => toast.error(errMsg(e)),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <form onSubmit={submit} noValidate className="flex flex-col gap-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-start">
            <div className="flex flex-col gap-1">
              <Input
                placeholder="CODE *"
                value={f.code}
                aria-invalid={Boolean(errors.code)}
                onChange={(e) => {
                  setF({ ...f, code: e.target.value.toUpperCase() });
                  if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
                }}
              />
              {errors.code && <p className="text-xs font-medium text-destructive">{errors.code}</p>}
            </div>
            <select
              aria-label="Type"
              value={f.kind}
              onChange={(e) => setF({ ...f, kind: e.target.value })}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            >
              <option value="PERCENT">Percent (%)</option>
              <option value="FLAT">Flat amount</option>
            </select>
            <div className="flex flex-col gap-1">
              <Input
                placeholder="Discount value *"
                inputMode="decimal"
                value={f.value}
                aria-invalid={Boolean(errors.value)}
                onChange={(e) => {
                  setF({ ...f, value: e.target.value });
                  if (errors.value) setErrors((prev) => ({ ...prev, value: undefined }));
                }}
              />
              {errors.value && <p className="text-xs font-medium text-destructive">{errors.value}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Input
                placeholder="Min order"
                inputMode="decimal"
                value={f.minOrderAmount}
                onChange={(e) => setF({ ...f, minOrderAmount: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Input
                placeholder="Max uses"
                inputMode="numeric"
                value={f.usageLimit}
                onChange={(e) => setF({ ...f, usageLimit: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={createCoupon.isPending}>
              {createCoupon.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </Card>
      <Card className="flex flex-col divide-y divide-border p-2">
        {isLoading ? (
          <Skeleton className="m-4 h-12" />
        ) : data && data.length > 0 ? (
          data.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className={cn("font-mono font-medium", !c.isActive && "text-muted-foreground line-through")}>{c.code}</p>
                <p className="text-xs text-muted-foreground">
                  {discountText(c.kind, c.value)}
                  {Number(c.minOrderAmount) > 0 && ` · min ${formatCurrency(c.minOrderAmount)}`}
                  {` · used ${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : ""}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => couponActive.mutate({ id: c.id, isActive: !c.isActive })}>
                  {c.isActive ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete coupon "${c.code}"?`,
                      description: "Customers will no longer be able to apply this coupon code at checkout.",
                      confirmText: "Delete coupon",
                      variant: "destructive",
                      icon: "trash",
                    });
                    if (ok) deleteCoupon.mutate(c.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">No coupons yet.</p>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">
        Cashiers enter a code at checkout. A coupon never stacks with a happy-hour discount — the bigger one applies.
      </p>
    </div>
  );
}

function HappyHour({ branchId }: { branchId: string | null }) {
  const { data, isLoading } = usePromotions(branchId);
  const { createPromotion, promotionActive, deletePromotion } = useMarketingActions(branchId);
  const confirm = useConfirm();
  const [f, setF] = useState({ name: "", kind: "PERCENT", value: "", start: "16:00", end: "19:00", days: [1, 2, 3, 4, 5] as number[] });
  const [errors, setErrors] = useState<{ name?: string; value?: string; days?: string }>({});

  const toggleDay = (d: number) => {
    setF((prev) => {
      const nextDays = prev.days.includes(d) ? prev.days.filter((x) => x !== d) : [...prev.days, d];
      if (nextDays.length > 0 && errors.days) {
        setErrors((errs) => ({ ...errs, days: undefined }));
      }
      return { ...prev, days: nextDays };
    });
  };

  const validate = () => {
    const errs: typeof errors = {};
    if (!f.name.trim()) errs.name = "Happy hour name is required";
    if (!f.value || isNaN(Number(f.value)) || Number(f.value) <= 0) errs.value = "Enter a valid positive value";
    if (f.days.length === 0) errs.days = "Select at least one day";
    return errs;
  };

  const submit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error(Object.values(errs)[0]);
      return;
    }
    setErrors({});
    createPromotion.mutate(
      { name: f.name.trim(), kind: f.kind, value: Number(f.value), daysOfWeek: f.days, startTime: f.start, endTime: f.end },
      {
        onSuccess: () => {
          toast.success("Happy hour created");
          setF({ ...f, name: "", value: "" });
          setErrors({});
        },
        onError: (e) => toast.error(errMsg(e)),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-start">
            <div className="flex flex-col gap-1">
              <Input
                placeholder="Name (e.g. Weekday happy hour) *"
                value={f.name}
                aria-invalid={Boolean(errors.name)}
                onChange={(e) => {
                  setF({ ...f, name: e.target.value });
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
              />
              {errors.name && <p className="text-xs font-medium text-destructive">{errors.name}</p>}
            </div>
            <select
              aria-label="Type"
              value={f.kind}
              onChange={(e) => setF({ ...f, kind: e.target.value })}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            >
              <option value="PERCENT">Percent (%)</option>
              <option value="FLAT">Flat amount</option>
            </select>
            <div className="flex flex-col gap-1">
              <Input
                placeholder="Value *"
                inputMode="decimal"
                value={f.value}
                aria-invalid={Boolean(errors.value)}
                onChange={(e) => {
                  setF({ ...f, value: e.target.value });
                  if (errors.value) setErrors((prev) => ({ ...prev, value: undefined }));
                }}
              />
              {errors.value && <p className="text-xs font-medium text-destructive">{errors.value}</p>}
            </div>
            <Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
            <Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {DAY_NAMES.map((n, d) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={cn(
                    "rounded-lg border px-3 py-1 text-xs transition-colors",
                    f.days.includes(d) ? "border-primary bg-primary text-primary-foreground font-medium" : "border-border text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {n}
                </button>
              ))}
              <Button type="submit" className="ml-auto" disabled={createPromotion.isPending}>
                {createPromotion.isPending ? "Creating…" : "Create"}
              </Button>
            </div>
            {errors.days && <p className="text-xs font-medium text-destructive">{errors.days}</p>}
          </div>
        </form>
      </Card>
      <Card className="flex flex-col divide-y divide-border p-2">
        {isLoading ? (
          <Skeleton className="m-4 h-12" />
        ) : data && data.length > 0 ? (
          data.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className={cn("font-medium", !p.isActive && "text-muted-foreground line-through")}>{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {discountText(p.kind, p.value)} · {p.daysOfWeek.map((d) => DAY_NAMES[d]).join(", ")} · {p.startTime}–{p.endTime}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => promotionActive.mutate({ id: p.id, isActive: !p.isActive })}>
                  {p.isActive ? "Pause" : "Resume"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete happy hour "${p.name}"?`,
                      description: "This happy hour schedule will be removed and automatic discounts will cease.",
                      confirmText: "Delete",
                      variant: "destructive",
                      icon: "trash",
                    });
                    if (ok) deletePromotion.mutate(p.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">No happy hours yet.</p>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">Applied automatically at checkout during the window, in the restaurant&rsquo;s timezone.</p>
    </div>
  );
}

function AudienceCount({ branchId, id }: { branchId: string | null; id: string }) {
  const { data } = useAudience(branchId, id);
  return <span>{data ? `${data.count} recipients` : "…"}</span>;
}

function Campaigns({ branchId }: { branchId: string | null }) {
  const { data, isLoading } = useCampaigns(branchId);
  const { createCampaign, deleteCampaign, sendCampaign } = useMarketingActions(branchId);
  const confirm = useConfirm();
  const [f, setF] = useState({ name: "", channel: "SMS", segment: "ALL", message: "" });
  const [errors, setErrors] = useState<{ name?: string; message?: string }>({});

  const validate = () => {
    const errs: typeof errors = {};
    if (!f.name.trim()) errs.name = "Campaign name is required";
    if (!f.message.trim()) errs.message = "Message text is required";
    return errs;
  };

  const submit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error(Object.values(errs)[0]);
      return;
    }
    setErrors({});
    createCampaign.mutate(
      {
        name: f.name.trim(),
        channel: f.channel,
        segment: f.segment,
        message: f.message.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Campaign saved");
          setF({ ...f, name: "", message: "" });
          setErrors({});
        },
        onError: (e) => toast.error(errMsg(e)),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3 items-start">
            <div className="flex flex-col gap-1">
              <Input
                placeholder="Campaign name *"
                value={f.name}
                aria-invalid={Boolean(errors.name)}
                onChange={(e) => {
                  setF({ ...f, name: e.target.value });
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
              />
              {errors.name && <p className="text-xs font-medium text-destructive">{errors.name}</p>}
            </div>
            <select
              aria-label="Channel"
              value={f.channel}
              onChange={(e) => setF({ ...f, channel: e.target.value })}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            >
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
            </select>
            <select
              aria-label="Audience"
              value={f.segment}
              onChange={(e) => setF({ ...f, segment: e.target.value })}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
            >
              <option value="ALL">All customers</option>
              <option value="LOYAL">Loyal (5+ orders)</option>
              <option value="LAPSED">Lapsed (60+ days)</option>
              <option value="BIRTHDAY_MONTH">Birthday this month</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Textarea
              aria-label="Message"
              placeholder="Message *"
              maxLength={600}
              value={f.message}
              aria-invalid={Boolean(errors.message)}
              onChange={(e) => {
                setF({ ...f, message: e.target.value });
                if (errors.message) setErrors((prev) => ({ ...prev, message: undefined }));
              }}
              className="min-h-20"
            />
            {errors.message && <p className="text-xs font-medium text-destructive">{errors.message}</p>}
          </div>
          <div>
            <Button type="submit" disabled={createCampaign.isPending}>
              {createCampaign.isPending ? "Saving…" : "Save campaign"}
            </Button>
          </div>
        </form>
      </Card>
      <Card className="flex flex-col divide-y divide-border p-2">
        {isLoading ? (
          <Skeleton className="m-4 h-12" />
        ) : data && data.length > 0 ? (
          data.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{c.name} <span className="text-xs text-muted-foreground">· {c.channel.toLowerCase()} · {c.segment.toLowerCase().replace("_", " ")}</span></p>
                <p className="text-xs text-muted-foreground">{c.message}</p>
                <p className="text-xs text-muted-foreground">
                  <AudienceCount branchId={branchId} id={c.id} />
                  {c.lastSentAt && ` · last sent ${new Date(c.lastSentAt).toLocaleString()} to ${c.lastSentCount ?? 0}`}
                </p>
              </div>
              <div className="flex gap-2">
                <a href={`/api/v1/marketing/campaigns/${c.id}/audience.csv?branchId=${branchId}`} className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm hover:bg-secondary">
                  <Download className="mr-2 h-4 w-4" /> Audience CSV
                </a>
                <Button
                  size="sm"
                  disabled={sendCampaign.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Send "${c.name}" now?`,
                      description: "This will immediately dispatch the campaign message to all matching recipients in this audience.",
                      confirmText: "Send campaign",
                      variant: "default",
                      icon: "info",
                    });
                    if (!ok) return;
                    sendCampaign.mutate(c.id, {
                      onSuccess: (r) => toast.success(`Sent to ${r.sent}${r.failed ? `, ${r.failed} failed` : ""}`),
                      onError: (e) => toast.error(errMsg(e)),
                    });
                  }}
                >
                  Send now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete campaign "${c.name}"?`,
                      description: "This campaign record and its history will be deleted.",
                      confirmText: "Delete",
                      variant: "destructive",
                      icon: "trash",
                    });
                    if (ok) deleteCampaign.mutate(c.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">No campaigns yet.</p>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">
        Email is sent through your SMTP server (set <code>SMTP_URL</code> and <code>SMTP_FROM</code> on the server).
        SMS and WhatsApp are handed to a webhook subscribed to <code>campaign.message</code> (Settings &gt; Webhooks) for
        your messaging service to deliver. Customers marked &ldquo;do not send marketing&rdquo; are always excluded.
      </p>
    </div>
  );
}

export default function MarketingPage() {
  const { branchId } = useBranch();
  const [tab, setTab] = useState<Tab>("coupons");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Marketing</h1>
        <p className="text-sm text-muted-foreground">Coupons, happy hours and customer campaigns</p>
      </div>
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded-full border px-3.5 py-1 text-xs capitalize transition-colors", tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary")}>
            {t}
          </button>
        ))}
      </div>
      {tab === "coupons" && <Coupons branchId={branchId} />}
      {tab === "happy hour" && <HappyHour branchId={branchId} />}
      {tab === "campaigns" && <Campaigns branchId={branchId} />}
    </div>
  );
}
