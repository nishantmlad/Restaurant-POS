import { Globe, Monitor, Package, Phone, QrCode, ShoppingBag, Tablet, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Online = guest ordered via website/QR; Offline = entered by staff.
export function ChannelBadge({ channel }: { channel: "STAFF" | "ONLINE" }) {
  const online = channel === "ONLINE";
  return (
    <Badge
      variant="secondary"
      className={cn(
        "inline-flex items-center gap-1 font-medium text-[11px] px-2 py-0.5 rounded-md",
        online
          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
          : "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20",
      )}
    >
      {online ? <Globe className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
      {online ? "Online" : "Counter POS"}
    </Badge>
  );
}

export const ORDER_TYPE_LABEL: Record<string, string> = {
  DINE_IN: "Dine-in",
  TAKEAWAY: "Takeaway",
  DELIVERY: "Delivery",
  DRIVE_THRU: "Drive-thru",
  QR_ORDER: "QR Order",
  KIOSK: "Kiosk",
  PHONE: "Phone Order",
};

export function TypeBadge({ type }: { type: string }) {
  const label = ORDER_TYPE_LABEL[type] ?? type.replace("_", " ");

  let icon = <Utensils className="h-3 w-3" />;
  let colorClass = "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";

  if (type === "TAKEAWAY") {
    icon = <ShoppingBag className="h-3 w-3" />;
    colorClass = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
  } else if (type === "DELIVERY") {
    icon = <Package className="h-3 w-3" />;
    colorClass = "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
  } else if (type === "KIOSK") {
    icon = <Tablet className="h-3 w-3" />;
    colorClass = "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20";
  } else if (type === "PHONE") {
    icon = <Phone className="h-3 w-3" />;
    colorClass = "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20";
  } else if (type === "QR_ORDER") {
    icon = <QrCode className="h-3 w-3" />;
    colorClass = "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20";
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        "inline-flex items-center gap-1 font-medium text-[11px] px-2 py-0.5 rounded-md border",
        colorClass,
      )}
    >
      {icon}
      {label}
    </Badge>
  );
}
