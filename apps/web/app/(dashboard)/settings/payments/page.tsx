"use client";

import { CheckCircle2, Copy, ExternalLink, HelpCircle, KeyRound, Loader2, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";

interface PaymentGatewayConfig {
  enabled: boolean;
  provider: "RAZORPAY";
  testMode: boolean;
  keyId: string;
  hasKeySecret: boolean;
  keySecretMasked: string;
  hasWebhookSecret: boolean;
  webhookSecretMasked: string;
  autoVerifyKiosk: boolean;
}

export default function PaymentGatewaySettingsPage() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["settings", "payment-gateway"],
    queryFn: () => api.get<PaymentGatewayConfig>("/settings/payment-gateway"),
  });

  const [enabled, setEnabled] = useState(false);
  const [testMode, setTestMode] = useState(true);
  const [autoVerifyKiosk, setAutoVerifyKiosk] = useState(true);
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setTestMode(config.testMode);
      setAutoVerifyKiosk(config.autoVerifyKiosk);
      setKeyId(config.keyId || "");
      setKeySecret(config.hasKeySecret ? config.keySecretMasked : "");
      setWebhookSecret(config.hasWebhookSecret ? config.webhookSecretMasked : "");
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: (body: any) => api.patch<PaymentGatewayConfig>("/settings/payment-gateway", body),
    onSuccess: (updated) => {
      queryClient.setQueryData(["settings", "payment-gateway"], updated);
      toast.success("Payment gateway settings saved successfully");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Failed to save settings");
    },
  });

  const testMutation = useMutation({
    mutationFn: (body: { keyId: string; keySecret?: string }) =>
      api.post<{ success: boolean; message: string }>("/settings/payment-gateway/test", body),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Connection test failed");
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      enabled,
      testMode,
      autoVerifyKiosk,
      keyId,
      keySecret: keySecret.includes("••••") ? undefined : keySecret,
      webhookSecret: webhookSecret.includes("••••") ? undefined : webhookSecret,
    });
  };

  const handleTestConnection = () => {
    if (!keyId.trim()) {
      toast.error("Please enter a Key ID to test");
      return;
    }
    testMutation.mutate({
      keyId,
      keySecret: keySecret.includes("••••") ? undefined : keySecret,
    });
  };

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/v1/public/webhooks/razorpay`
      : "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Restaurant, branch, and payment configuration</p>
      </div>

      <SettingsTabs />

      {isLoading || !config ? (
        <Card className="p-6">
          <Skeleton className="h-72 w-full rounded-xl" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6 lg:col-span-2 flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-border/80 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Razorpay Dynamic UPI Gateway
                </h2>
                <p className="text-xs text-muted-foreground">
                  Automated real-time bank verification for Kiosk and QR orders
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="gw-toggle" className="text-xs font-semibold">
                  {enabled ? "Active" : "Disabled"}
                </Label>
                <Switch id="gw-toggle" checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-5">
              {/* Test mode switch */}
              <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/20 p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-warning" />
                    Sandbox / Test Mode
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Use Razorpay test keys (starts with <code>rzp_test_</code>) to simulate payments without real money.
                  </p>
                </div>
                <Switch checked={testMode} onCheckedChange={setTestMode} />
              </div>

              {/* Auto verify switch */}
              <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/20 p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    100% Automated Kiosk Bank Verification
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Kiosk releases tickets to the kitchen ONLY after money is verified by the bank.
                  </p>
                </div>
                <Switch checked={autoVerifyKiosk} onCheckedChange={setAutoVerifyKiosk} />
              </div>

              {/* Key ID */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="key-id">
                  Key ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="key-id"
                  placeholder={testMode ? "rzp_test_..." : "rzp_live_..."}
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Found in your Razorpay Dashboard &gt; Settings &gt; API Keys.
                </p>
              </div>

              {/* Key Secret */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="key-secret">
                  Key Secret <span className="text-destructive">*</span>
                </Label>
                <PasswordInput
                  id="key-secret"
                  placeholder={config.hasKeySecret ? "Leave unchanged or enter new secret" : "Enter Key Secret"}
                  value={keySecret}
                  onChange={(e) => setKeySecret(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              {/* Webhook Secret */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="webhook-secret">Webhook Secret (Optional)</Label>
                <PasswordInput
                  id="webhook-secret"
                  placeholder={config.hasWebhookSecret ? "Configured" : "Optional webhook secret for signature check"}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              {/* Webhook Endpoint Box */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-muted/10 p-3.5">
                <Label className="text-xs font-semibold text-foreground">Razorpay Webhook URL</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={webhookUrl} className="font-mono text-xs bg-background h-8" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      toast.success("Webhook URL copied to clipboard");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  In Razorpay Dashboard &gt; Webhooks &gt; Add New: Subscribe to <code>order.paid</code> and <code>payment.captured</code>.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-border/80">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testMutation.isPending || !keyId.trim()}
                >
                  {testMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      Testing…
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </Button>

                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving…" : "Save Configuration"}
                </Button>
              </div>
            </form>
          </Card>

          {/* Quick Guide Card */}
          <div className="flex flex-col gap-4">
            <Card className="p-5 flex flex-col gap-3 border-primary/20 bg-primary/5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-primary" />
                How to get Razorpay Test Keys
              </h3>
              <ol className="text-xs text-muted-foreground flex flex-col gap-2 list-decimal pl-4">
                <li>
                  Sign up for free at{" "}
                  <a
                    href="https://razorpay.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline inline-flex items-center"
                  >
                    razorpay.com <ExternalLink className="h-3 w-3 ml-0.5" />
                  </a>{" "}
                  (using any email, no GST required).
                </li>
                <li>Switch the toggle at the top left to <strong>Test Mode</strong>.</li>
                <li>Go to <strong>Settings &gt; API Keys</strong>.</li>
                <li>Click <strong>Generate Key</strong> to get your <code>Key ID</code> and <code>Key Secret</code>.</li>
                <li>Paste them here and click <strong>Test Connection</strong>.</li>
              </ol>
            </Card>

            <Card className="p-5 flex flex-col gap-2.5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-warning" />
                Built-in Dev Test Simulator
              </h3>
              <p className="text-xs text-muted-foreground">
                In Test Mode, you don&apos;t even have to scan on your phone! A <strong>&quot;Simulate Bank Payment Success&quot;</strong> button appears on the Kiosk screen so you can test the end-to-end flow with a single click.
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

