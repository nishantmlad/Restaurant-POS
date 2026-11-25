"use client";

import { useState } from "react";
import {
  ChefHat,
  CheckCircle2,
  Eye,
  FileText,
  ImageIcon,
  Printer,
  Receipt,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusNote, useNoteToast } from "@/components/ui/status-note";
import { useBranch } from "@/hooks/use-branch";
import { useSettings, useUpdateBranchSettings } from "@/hooks/use-settings";
import { usePrintTestSlip } from "@/hooks/use-print";
import { ApiError } from "@/lib/api";
import {
  type BillTemplateDto,
  type KotTemplateDto,
  type PageOrientation,
  type PageSize,
  type PrinterType,
  type PrintTemplateDto,
  PAGE_ORIENTATIONS,
  PAGE_SIZES,
  PRINTER_TYPES,
} from "@nodedr-restaurant/types";
import { cn } from "@/lib/utils";

const DEFAULT_BILL_TEMPLATE: BillTemplateDto = {
  printerType: "thermal",
  pageSize: "80mm",
  pageOrientation: "portrait",
  comPort: null,
  showLogo: false,
  titleSize: "large",
  titleStyle: "bold",
  tagline: "",
  fontSize: "normal",
  fontThickness: "bold",
  fontStyle: "sans",
  showAddress: true,
  showPhone: true,
  showGstNumber: true,
  showCustomerDetails: true,
  showItemTaxRate: true,
  showPaymentDetails: false,
  footerNote: "Thank you! Visit again.",
};

const DEFAULT_KOT_TEMPLATE: KotTemplateDto = {
  printerType: "thermal",
  pageSize: "80mm",
  pageOrientation: "portrait",
  connection: "BRANCH_DEFAULT",
  host: null,
  port: 9100,
  titleSize: "large",
  titleStyle: "extrabold",
  fontSize: "large",
  fontThickness: "extrabold",
  showCustomer: true,
  showTable: true,
  showOrderNumber: true,
  showItemNotes: true,
};

const PRINTER_TYPE_CONFIG: Record<
  PrinterType,
  { label: string; desc: string; icon: string }
> = {
  thermal: {
    label: "Thermal Printers",
    desc: "Roll-fed receipt printers (80mm / 58mm) via USB, Bluetooth, or LAN",
    icon: "Receipt",
  },
  led: {
    label: "LED Printers",
    desc: "High-speed electrophotographic page printers (OKI, Brother, Xerox)",
    icon: "Printer",
  },
  mfp: {
    label: "Multifunction Printers (MFP)",
    desc: "All-in-one Laser & Inkjet office printers (HP, Canon, Epson, Brother)",
    icon: "FileText",
  },
};

const PAGE_SIZE_CONFIG: Record<
  PageSize,
  { label: string; sub: string; category: "thermal" | "sheet" }
> = {
  "80mm": { label: "80 mm Roll", sub: "Standard Thermal POS", category: "thermal" },
  "58mm": { label: "58 mm Roll", sub: "Compact Thermal POS", category: "thermal" },
  A4: { label: "A4", sub: "210 × 297 mm · Full Tax Invoice", category: "sheet" },
  A5: { label: "A5", sub: "148 × 210 mm · Half Sheet Bill", category: "sheet" },
  A6: { label: "A6", sub: "105 × 148 mm · Compact Slip", category: "sheet" },
  A7: { label: "A7", sub: "74 × 105 mm · Pocket Voucher", category: "sheet" },
  A3: { label: "A3", sub: "297 × 420 mm · Ledger Sheet", category: "sheet" },
  A2: { label: "A2", sub: "420 × 594 mm · Large Format", category: "sheet" },
  A1: { label: "A1", sub: "594 × 841 mm · Commercial Poster", category: "sheet" },
};

export function PrintTemplateCard() {
  const { branchId } = useBranch();
  const { data: settings } = useSettings(branchId);
  const updateBranch = useUpdateBranchSettings(branchId);
  const testPrint = usePrintTestSlip(branchId);
  const testKot = usePrintTestSlip(branchId, "kot");
  const { note, clear: clearNote, toast } = useNoteToast();

  const branch = settings?.branch;
  const restaurant = settings?.restaurant;

  const currentTemplate: PrintTemplateDto = (branch?.printTemplate as PrintTemplateDto) ?? {};
  const [activeTab, setActiveTab] = useState<"bill" | "kot">("bill");
  const [previewMode, setPreviewMode] = useState<"auto" | "slip" | "sheet">("auto");

  const [bill, setBill] = useState<BillTemplateDto>({
    ...DEFAULT_BILL_TEMPLATE,
    ...(currentTemplate.bill ?? {}),
  });

  const [kot, setKot] = useState<KotTemplateDto>({
    ...DEFAULT_KOT_TEMPLATE,
    ...(currentTemplate.kot ?? {}),
  });

  // Track changes to enable Save
  const [dirty, setDirty] = useState(false);

  const updateBill = (patch: Partial<BillTemplateDto>) => {
    setBill((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const updateKot = (patch: Partial<KotTemplateDto>) => {
    setKot((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const isSheetMode = bill.pageSize && !["80mm", "58mm"].includes(bill.pageSize);
  const showSheetPreview =
    previewMode === "sheet" || (previewMode === "auto" && isSheetMode);

  const handleSave = () => {
    updateBranch.mutate(
      {
        printTemplate: {
          bill,
          kot,
        },
      },
      {
        onSuccess: () => {
          setDirty(false);
          toast.success("Printout templates saved successfully!");
        },
        onError: (err) => {
          toast.error(
            err instanceof ApiError ? err.message : "Failed to save template settings",
          );
        },
      },
    );
  };

  const handleReset = () => {
    if (activeTab === "bill") {
      setBill({ ...DEFAULT_BILL_TEMPLATE });
    } else {
      setKot({ ...DEFAULT_KOT_TEMPLATE });
    }
    setDirty(true);
  };

  // Preview styling calculations
  const previewFontFamily =
    bill.fontStyle === "mono"
      ? "font-mono"
      : bill.fontStyle === "condensed"
        ? "tracking-tighter font-sans"
        : "font-sans";

  const previewTitleClass = cn(
    "text-center text-black leading-tight",
    bill.titleSize === "xlarge" ? "text-xl" : bill.titleSize === "large" ? "text-base" : "text-sm",
    bill.titleStyle === "extrabold" ? "font-black" : bill.titleStyle === "bold" ? "font-bold" : "font-semibold",
  );

  const previewBodyClass = cn(
    previewFontFamily,
    "text-black leading-snug",
    bill.fontSize === "large" ? "text-sm" : bill.fontSize === "small" ? "text-[11px]" : "text-xs",
    bill.fontThickness === "extrabold" ? "font-extrabold" : bill.fontThickness === "bold" ? "font-bold" : "font-medium",
  );

  const previewKotTitleClass = cn(
    "text-center text-black leading-tight uppercase tracking-wider",
    kot.titleSize === "xlarge" ? "text-xl font-black" : kot.titleSize === "large" ? "text-base font-extrabold" : "text-sm font-bold",
  );

  const previewKotBodyClass = cn(
    "text-black leading-snug font-sans",
    kot.fontSize === "xlarge" ? "text-base" : kot.fontSize === "large" ? "text-sm" : "text-xs",
    kot.fontThickness === "extrabold" ? "font-black" : "font-bold",
  );

  return (
    <Card className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Printout Templates &amp; Typography
          </h2>
          <p className="text-sm text-muted-foreground">
            Customize font sizes, text boldness, header details, and custom notes for bills and kitchen tickets
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset tab
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || updateBranch.isPending}
            className="min-w-[110px]"
          >
            <Save className="mr-1.5 h-4 w-4" />
            {updateBranch.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <StatusNote note={note} onClear={clearNote} />

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("bill")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
            activeTab === "bill"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-secondary/60 text-muted-foreground hover:bg-secondary",
          )}
        >
          <Receipt className="h-4 w-4" /> Bill &amp; GST Receipt
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("kot")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
            activeTab === "kot"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-secondary/60 text-muted-foreground hover:bg-secondary",
          )}
        >
          <ChefHat className="h-4 w-4" /> Kitchen Ticket (KOT)
        </button>
      </div>

      {/* Main Grid: Controls on left, Live Mockup on right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: Controls */}
        <div className="flex flex-col gap-5">
          {activeTab === "bill" ? (
            <>
              {/* Printer Hardware & Type Configuration */}
              <div className="flex flex-col gap-3 rounded-lg border border-border p-4 bg-secondary/15">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Printer className="h-3.5 w-3.5 text-primary" /> Printer Type &amp; Technology
                  </span>
                  <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                    {PRINTER_TYPE_CONFIG[bill.printerType ?? "thermal"]?.label}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {(["thermal", "led", "mfp"] as const).map((type) => {
                    const isSelected = (bill.printerType ?? "thermal") === type;
                    const conf = PRINTER_TYPE_CONFIG[type];
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          const nextPaper: PageSize =
                            type === "thermal"
                              ? "80mm"
                              : bill.pageSize === "80mm" || bill.pageSize === "58mm"
                                ? "A4"
                                : (bill.pageSize ?? "A4");
                          updateBill({ printerType: type, pageSize: nextPaper });
                        }}
                        className={cn(
                          "flex flex-col text-left p-3 rounded-xl border transition-all text-xs gap-1.5",
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                            : "border-border bg-card hover:bg-secondary/40",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">{conf.label}</span>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">{conf.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Paper Size & Page Dimensions (A1 to A7 & 80/58mm Thermal) */}
              <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" /> Page Size &amp; Paper Format
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Select roll-fed thermal receipt (80mm/58mm) or standard page sheet (A1 to A7)
                    </p>
                  </div>
                  {isSheetMode && (
                    <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg">
                      <span className="text-[11px] text-muted-foreground px-1.5">Orientation:</span>
                      {(["portrait", "landscape"] as const).map((orient) => (
                        <Button
                          key={orient}
                          type="button"
                          variant={bill.pageOrientation === orient ? "default" : "ghost"}
                          size="sm"
                          className="h-6 text-[11px] px-2 capitalize"
                          onClick={() => updateBill({ pageOrientation: orient })}
                        >
                          {orient}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {PAGE_SIZES.map((size) => {
                    const isSelected = (bill.pageSize ?? "80mm") === size;
                    const conf = PAGE_SIZE_CONFIG[size];
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          const nextPrinter: PrinterType =
                            size === "80mm" || size === "58mm"
                              ? "thermal"
                              : bill.printerType === "thermal"
                                ? "mfp"
                                : (bill.printerType ?? "mfp");
                          updateBill({ pageSize: size, printerType: nextPrinter });
                        }}
                        className={cn(
                          "flex flex-col p-2.5 rounded-lg border text-left transition-all gap-0.5 text-xs",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground font-semibold shadow-sm"
                            : "border-border bg-card hover:bg-secondary/40 text-foreground",
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold">{conf.label}</span>
                          {isSelected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                        </div>
                        <span
                          className={cn(
                            "text-[10px] leading-tight line-clamp-1",
                            isSelected ? "text-primary-foreground/85" : "text-muted-foreground",
                          )}
                        >
                          {conf.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Header & Title Section */}
              <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Header &amp; Title Styling
                </span>

                {/* Restaurant Logo Option */}
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-secondary/20 p-3">
                  <div className="flex items-center gap-2.5">
                    {restaurant?.logoUrl ? (
                      <img
                        src={restaurant.logoUrl}
                        alt="Restaurant logo"
                        className="h-10 w-10 rounded-md border border-border bg-white object-contain p-1"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          Display Logo on Receipt
                        </span>
                        {restaurant?.logoUrl ? (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            Logo Uploaded
                          </span>
                        ) : (
                          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            No Logo Uploaded
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {restaurant?.logoUrl
                          ? "Print your official restaurant logo centered above the restaurant title"
                          : "Upload your brand logo under Restaurant Details above to enable receipt logo"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={Boolean(bill.showLogo && restaurant?.logoUrl)}
                    disabled={!restaurant?.logoUrl}
                    onCheckedChange={(checked) => updateBill({ showLogo: checked })}
                    aria-label="Display restaurant logo"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Restaurant Title Size</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["normal", "large", "xlarge"] as const).map((s) => (
                        <Button
                          key={s}
                          type="button"
                          variant={bill.titleSize === s ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs capitalize"
                          onClick={() => updateBill({ titleSize: s })}
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Title Thickness / Weight</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["normal", "bold", "extrabold"] as const).map((w) => (
                        <Button
                          key={w}
                          type="button"
                          variant={bill.titleStyle === w ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs capitalize"
                          onClick={() => updateBill({ titleStyle: w })}
                        >
                          {w === "extrabold" ? "Heavy" : w}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Sub-heading / Tagline (Optional)</Label>
                  <Input
                    placeholder="e.g. Pure Veg Restaurant · Authentic Taste"
                    value={bill.tagline ?? ""}
                    onChange={(e) => updateBill({ tagline: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Typography & Thickness */}
              <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Receipt Font &amp; Thickness
                </span>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Font Size</Label>
                    <div className="grid grid-cols-3 gap-1">
                      {(["small", "normal", "large"] as const).map((s) => (
                        <Button
                          key={s}
                          type="button"
                          variant={bill.fontSize === s ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs capitalize"
                          onClick={() => updateBill({ fontSize: s })}
                        >
                          {s === "small" ? "Compact" : s}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Font Thickness</Label>
                    <div className="grid grid-cols-3 gap-1">
                      {(["normal", "bold", "extrabold"] as const).map((w) => (
                        <Button
                          key={w}
                          type="button"
                          variant={bill.fontThickness === w ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs capitalize"
                          onClick={() => updateBill({ fontThickness: w })}
                        >
                          {w === "extrabold" ? "Heavy" : w}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Font Style</Label>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { key: "sans", label: "Clean" },
                          { key: "mono", label: "Mono" },
                          { key: "condensed", label: "Narrow" },
                        ] as const
                      ).map((f) => (
                        <Button
                          key={f.key}
                          type="button"
                          variant={bill.fontStyle === f.key ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => updateBill({ fontStyle: f.key })}
                        >
                          {f.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Header &amp; Line Details
                </span>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <label className="flex items-center justify-between gap-2 text-xs">
                    <span>Show Branch Address</span>
                    <Switch
                      checked={bill.showAddress !== false}
                      onCheckedChange={(checked) => updateBill({ showAddress: checked })}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-2 text-xs">
                    <span>Show Phone Number</span>
                    <Switch
                      checked={bill.showPhone !== false}
                      onCheckedChange={(checked) => updateBill({ showPhone: checked })}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-2 text-xs">
                    <span>Show GSTIN / Tax ID</span>
                    <Switch
                      checked={bill.showGstNumber !== false}
                      onCheckedChange={(checked) => updateBill({ showGstNumber: checked })}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-2 text-xs">
                    <span>Show Customer / Guest Name</span>
                    <Switch
                      checked={bill.showCustomerDetails !== false}
                      onCheckedChange={(checked) => updateBill({ showCustomerDetails: checked })}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-2 text-xs">
                    <span>Show Tax Slab per Item (e.g. GST @ 5%)</span>
                    <Switch
                      checked={bill.showItemTaxRate !== false}
                      onCheckedChange={(checked) => updateBill({ showItemTaxRate: checked })}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-2 text-xs">
                    <span>Show Payment Details (Paid, Received, Change, Balance Due)</span>
                    <Switch
                      checked={bill.showPaymentDetails === true}
                      onCheckedChange={(checked) => updateBill({ showPaymentDetails: checked })}
                    />
                  </label>
                </div>

                <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-3">
                  <Label className="text-xs">Footer / Thank You Note</Label>
                  <Input
                    placeholder="e.g. Thank you! Visit again."
                    value={bill.footerNote ?? ""}
                    onChange={(e) => updateBill({ footerNote: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Kitchen Dedicated Printer Hardware Routing */}
              <div className="flex flex-col gap-3 rounded-lg border border-border p-4 bg-secondary/15">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Printer className="h-3.5 w-3.5 text-primary" /> Kitchen Printer Destination
                  </span>
                  <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                    {kot.connection === "NETWORK"
                      ? "Separate Kitchen LAN/Wi-Fi"
                      : kot.connection === "BLUETOOTH"
                        ? `Bluetooth (${kot.comPort || "COM8"})`
                        : "Counter / Main Printer"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => updateKot({ connection: "BRANCH_DEFAULT" })}
                    className={cn(
                      "flex flex-col text-left p-3 rounded-xl border transition-all text-xs gap-1",
                      (kot.connection ?? "BRANCH_DEFAULT") === "BRANCH_DEFAULT"
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                        : "border-border bg-card hover:bg-secondary/40",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">Same as Counter</span>
                      {(kot.connection ?? "BRANCH_DEFAULT") === "BRANCH_DEFAULT" && (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Prints kitchen tickets on the main counter printer.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateKot({ connection: "BLUETOOTH", comPort: kot.comPort || "COM8" })}
                    className={cn(
                      "flex flex-col text-left p-3 rounded-xl border transition-all text-xs gap-1",
                      kot.connection === "BLUETOOTH"
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                        : "border-border bg-card hover:bg-secondary/40",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">2nd Bluetooth / USB</span>
                      {kot.connection === "BLUETOOTH" && (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Direct Bluetooth COM port for kitchen printer (e.g. COM8).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateKot({ connection: "NETWORK" })}
                    className={cn(
                      "flex flex-col text-left p-3 rounded-xl border transition-all text-xs gap-1",
                      kot.connection === "NETWORK"
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                        : "border-border bg-card hover:bg-secondary/40",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">Kitchen LAN / Wi-Fi</span>
                      {kot.connection === "NETWORK" && (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Network IP on port 9100.
                    </p>
                  </button>
                </div>

                {kot.connection === "BLUETOOTH" && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-border/80">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Kitchen Bluetooth / Serial COM Port</Label>
                      <span className="text-[10px] text-muted-foreground">
                        Check in Windows Bluetooth &gt; More Bluetooth settings &gt; COM Ports
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="e.g. COM8"
                        value={kot.comPort ?? "COM8"}
                        onChange={(e) => updateKot({ comPort: e.target.value.toUpperCase().trim() })}
                        className="h-8 text-xs font-mono max-w-[140px]"
                      />
                      <div className="flex items-center gap-1">
                        {["COM8", "COM4", "COM5", "COM6", "COM3"].map((p) => (
                          <Button
                            key={p}
                            type="button"
                            variant={kot.comPort === p ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-[11px] px-2 font-mono"
                            onClick={() => updateKot({ comPort: p })}
                          >
                            {p}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {kot.connection === "NETWORK" && (
                  <div className="grid grid-cols-[1fr_6rem] gap-3 pt-1 border-t border-border/80">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Kitchen Printer IP Address</Label>
                      <Input
                        placeholder="192.168.1.150"
                        value={kot.host ?? ""}
                        onChange={(e) => updateKot({ host: e.target.value })}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Port</Label>
                      <Input
                        type="number"
                        placeholder="9100"
                        value={kot.port ?? 9100}
                        onChange={(e) => updateKot({ port: Number(e.target.value) || 9100 })}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* KOT Styling Controls */}
              <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  KOT Title &amp; Typography
                </span>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">KOT Header Size</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["normal", "large", "xlarge"] as const).map((s) => (
                        <Button
                          key={s}
                          type="button"
                          variant={kot.titleSize === s ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs capitalize"
                          onClick={() => updateKot({ titleSize: s })}
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">KOT Items Font Size</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["normal", "large", "xlarge"] as const).map((s) => (
                        <Button
                          key={s}
                          type="button"
                          variant={kot.fontSize === s ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs capitalize"
                          onClick={() => updateKot({ fontSize: s })}
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">KOT Text Boldness</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["bold", "extrabold"] as const).map((w) => (
                      <Button
                        key={w}
                        type="button"
                        variant={kot.fontThickness === w ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs capitalize"
                        onClick={() => updateKot({ fontThickness: w })}
                      >
                        {w === "extrabold" ? "Heavy / High Contrast" : "Bold"}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* KOT Toggles */}
              <div className="flex flex-col gap-2.5 rounded-lg border border-border p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Kitchen Information Display
                </span>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <label className="flex items-center justify-between gap-2 text-xs">
                    <span>Show Order # Prominently</span>
                    <Switch
                      checked={kot.showOrderNumber !== false}
                      onCheckedChange={(checked) => updateKot({ showOrderNumber: checked })}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-2 text-xs">
                    <span>Show Table Number</span>
                    <Switch
                      checked={kot.showTable !== false}
                      onCheckedChange={(checked) => updateKot({ showTable: checked })}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-2 text-xs">
                    <span>Show Customer Name</span>
                    <Switch
                      checked={kot.showCustomer !== false}
                      onCheckedChange={(checked) => updateKot({ showCustomer: checked })}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-2 text-xs">
                    <span>Show Kitchen Item Notes</span>
                    <Switch
                      checked={kot.showItemNotes !== false}
                      onCheckedChange={(checked) => updateKot({ showItemNotes: checked })}
                    />
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Test Printing Quick Action */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testPrint.isPending}
              onClick={() =>
                testPrint.mutate(undefined, {
                  onSuccess: () => toast.success("Test receipt sent to printer!"),
                  onError: (err) =>
                    toast.error(
                      err instanceof ApiError ? err.message : "Printer test failed",
                    ),
                })
              }
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              {testPrint.isPending ? "Sending…" : "Test Thermal Slip"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testKot.isPending}
              onClick={() =>
                testKot.mutate(undefined, {
                  onSuccess: () => toast.success("Test KOT sent to printer!"),
                  onError: (err) =>
                    toast.error(
                      err instanceof ApiError ? err.message : "Printer test failed",
                    ),
                })
              }
            >
              <ChefHat className="mr-1.5 h-3.5 w-3.5" />
              {testKot.isPending ? "Sending…" : "Test Kitchen Slip"}
            </Button>
          </div>
        </div>

        {/* Right: Live Visual Mockup Slip or Sheet */}
        <div className="flex flex-col items-center">
          <div className="mb-2 flex w-full items-center justify-between gap-1.5 text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-primary" />
              <span>
                {showSheetPreview
                  ? `Live Sheet Preview (${bill.pageSize ?? "A4"})`
                  : `Live Slip Preview (${bill.pageSize === "58mm" ? "58mm" : "80mm"})`}
              </span>
            </div>
            {activeTab === "bill" && (
              <div className="flex items-center gap-0.5 rounded-md bg-secondary/80 p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setPreviewMode("slip")}
                  className={cn(
                    "rounded px-1.5 py-0.5 transition font-semibold",
                    !showSheetPreview
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Slip
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("sheet")}
                  className={cn(
                    "rounded px-1.5 py-0.5 transition font-semibold",
                    showSheetPreview
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Sheet
                </button>
              </div>
            )}
          </div>

          {showSheetPreview && activeTab === "bill" ? (
            /* Live Sheet / Invoice Preview (A1 to A7) */
            <div className="relative w-full max-w-[320px] rounded-lg border border-black/20 bg-white p-3.5 text-black shadow-md font-sans text-xs">
              <div className="flex justify-between items-start border-b border-black pb-2 gap-2">
                <div className="flex-1">
                  {bill.showLogo && restaurant?.logoUrl && (
                    <img
                      src={restaurant.logoUrl}
                      alt="Logo"
                      className="h-8 max-w-[80px] object-contain mb-1 filter grayscale"
                    />
                  )}
                  <div className="font-black text-xs uppercase leading-tight text-black">
                    {restaurant?.name ?? "Restaurant Name"}
                  </div>
                  {bill.tagline && (
                    <div className="text-[9px] italic text-neutral-600">{bill.tagline}</div>
                  )}
                  <div className="text-[9px] text-neutral-800 leading-tight mt-0.5">
                    <div>{branch?.name ?? "Main Branch"}</div>
                    {bill.showAddress !== false && <div>123 Market Road, City</div>}
                    {bill.showPhone !== false && <div>Ph: +91 98765 43210</div>}
                    {bill.showGstNumber !== false && (
                      <div className="font-bold text-black">GSTIN: 24AAAAA0000A1Z5</div>
                    )}
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <div className="bg-black text-white px-2 py-0.5 text-[8.5px] font-black uppercase rounded mb-1 tracking-wider">
                    Tax Invoice
                  </div>
                  <div className="text-[9.5px] font-bold text-black">#20261116-0001</div>
                  <div className="text-[8.5px] text-neutral-600">16/11/2026, 04:30 PM</div>
                  <div className="text-[8.5px] text-neutral-800 font-medium">Dine In · Table #3</div>
                  {bill.showCustomerDetails !== false && (
                    <div className="text-[8.5px] font-semibold text-black">Guest: Mayank P.</div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-[9px] mt-2 border-collapse border border-neutral-300">
                <thead>
                  <tr className="bg-neutral-100 border-b border-neutral-300 text-[8px] font-black uppercase text-black">
                    <th className="p-1 border-r border-neutral-300">#</th>
                    <th className="p-1 border-r border-neutral-300">Item</th>
                    <th className="p-1 text-right border-r border-neutral-300">Rate</th>
                    <th className="p-1 text-center border-r border-neutral-300">Qty</th>
                    <th className="p-1 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-neutral-200">
                    <td className="p-1 border-r border-neutral-200 text-center">1</td>
                    <td className="p-1 border-r border-neutral-200">
                      <div className="font-bold">Paneer Butter Masala</div>
                      {bill.showItemTaxRate !== false && (
                        <div className="text-[7.5px] text-neutral-500">GST @ 5%</div>
                      )}
                    </td>
                    <td className="p-1 text-right border-r border-neutral-200">₹320</td>
                    <td className="p-1 text-center font-bold border-r border-neutral-200">2</td>
                    <td className="p-1 text-right font-bold">₹640</td>
                  </tr>
                  <tr className="border-b border-neutral-200">
                    <td className="p-1 border-r border-neutral-200 text-center">2</td>
                    <td className="p-1 border-r border-neutral-200">
                      <div className="font-bold">Tandoori Roti (Butter)</div>
                      {bill.showItemTaxRate !== false && (
                        <div className="text-[7.5px] text-neutral-500">GST @ 5%</div>
                      )}
                    </td>
                    <td className="p-1 text-right border-r border-neutral-200">₹25</td>
                    <td className="p-1 text-center font-bold border-r border-neutral-200">4</td>
                    <td className="p-1 text-right font-bold">₹100</td>
                  </tr>
                </tbody>
              </table>

              {/* Summary Grid */}
              <div className="flex justify-between items-start mt-2 pt-1 border-t border-black gap-2">
                <div className="text-[8px] text-neutral-600 flex-1">
                  <div className="border border-dashed border-neutral-400 p-1 rounded bg-neutral-50">
                    <div className="font-bold uppercase text-[7.5px] text-black">Terms</div>
                    <div>1. Goods once sold not returned.</div>
                    <div>2. Computer generated tax invoice.</div>
                  </div>
                  <div className="mt-1 font-semibold text-black">
                    {bill.footerNote?.trim() || "Thank you! Visit again."}
                  </div>
                </div>

                <div className="w-[125px] text-[9px] flex flex-col gap-0.5">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-semibold">₹740.00</span>
                  </div>
                  <div className="flex justify-between text-neutral-700">
                    <span>CGST (2.5%):</span>
                    <span>₹18.50</span>
                  </div>
                  <div className="flex justify-between text-neutral-700">
                    <span>SGST (2.5%):</span>
                    <span>₹18.50</span>
                  </div>
                  <div className="flex justify-between bg-black text-white px-1.5 py-1 rounded font-black text-[10px] mt-0.5">
                    <span>GRAND TOTAL:</span>
                    <span>₹740.00</span>
                  </div>
                  <div className="text-right text-[7.5px] mt-2 pt-1 border-t border-neutral-300 text-neutral-800">
                    <div>For {restaurant?.name ?? "Restaurant"}</div>
                    <div className="font-semibold mt-1">Authorized Signatory</div>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-center text-[8px] text-muted-foreground border-t border-dashed border-neutral-300 pt-1">
                Paper: {PAGE_SIZE_CONFIG[bill.pageSize ?? "A4"]?.label} ({bill.pageOrientation ?? "portrait"})
              </div>
            </div>
          ) : (
            /* Live Thermal Slip Preview (80mm / 58mm) */
            <div
              className={cn(
                "relative w-full rounded-sm bg-[#fafafa] p-4 text-black shadow-md ring-1 ring-black/10",
                bill.pageSize === "58mm" ? "max-w-[240px]" : "max-w-[290px]",
              )}
            >
              {/* Top decorative tear */}
              <div className="absolute -top-1.5 left-0 right-0 h-1.5 bg-[radial-gradient(ellipse_at_top,_transparent_3px,_#fafafa_3px)] bg-[length:8px_6px] bg-repeat-x" />

              {activeTab === "bill" ? (
                <div className={cn("flex flex-col gap-1.5", previewBodyClass)}>
                  {/* Logo Preview */}
                  {bill.showLogo && restaurant?.logoUrl && (
                    <div className="flex justify-center pb-1">
                      <img
                        src={restaurant.logoUrl}
                        alt="Restaurant Logo"
                        className="max-h-14 max-w-[140px] object-contain filter brightness-0"
                      />
                    </div>
                  )}
                  {/* Title & Tagline */}
                  <div className={previewTitleClass}>
                    {restaurant?.name ?? "Restaurant Name"}
                  </div>
                  {bill.tagline && (
                    <div className="text-center text-[10px] italic text-neutral-800">
                      {bill.tagline}
                    </div>
                  )}
                  <div className="text-center text-[10.5px] leading-tight text-neutral-800">
                    <div>{branch?.name ?? "Main Branch"}</div>
                    {bill.showAddress !== false && <div>123 Market Road, City</div>}
                    {bill.showPhone !== false && <div>Ph: +91 98765 43210</div>}
                    {bill.showGstNumber !== false && (
                      <div className="font-bold">GSTIN: 24AAAAA0000A1Z5</div>
                    )}
                  </div>

                  <div className="my-1 border-t-2 border-black" />

                  <div className="text-[11px] text-neutral-900">
                    <div>16/11/2026, 04:30 PM</div>
                    <div>Order: #20261116-0001 · DINE IN</div>
                    <div>Table: Table #3</div>
                    {bill.showCustomerDetails !== false && <div>Guest: Mayank Parmar</div>}
                  </div>

                  <div className="my-1 border-t-2 border-black" />

                  {/* Items */}
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-black text-[10px] uppercase">
                        <th>Item</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Rate</th>
                        <th className="text-right">Amt</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="pt-1">
                          <div>Paneer Butter Masala</div>
                          {bill.showItemTaxRate !== false && (
                            <div className="text-[9.5px] text-neutral-700">GST @ 5%</div>
                          )}
                        </td>
                        <td className="text-right pt-1">2</td>
                        <td className="text-right pt-1">₹320</td>
                        <td className="text-right pt-1 font-bold">₹640</td>
                      </tr>
                      <tr>
                        <td className="pt-1">
                          <div>Tandoori Roti (Butter)</div>
                          {bill.showItemTaxRate !== false && (
                            <div className="text-[9.5px] text-neutral-700">GST @ 5%</div>
                          )}
                        </td>
                        <td className="text-right pt-1">4</td>
                        <td className="text-right pt-1">₹25</td>
                        <td className="text-right pt-1 font-bold">₹100</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="my-1 border-t-2 border-black" />

                  {/* Totals */}
                  <div className="flex flex-col gap-0.5 text-[11.5px]">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>₹740.00</span>
                    </div>
                    <div className="flex justify-between text-neutral-800">
                      <span>CGST (2.5%)</span>
                      <span>₹18.50</span>
                    </div>
                    <div className="flex justify-between text-neutral-800">
                      <span>SGST (2.5%)</span>
                      <span>₹18.50</span>
                    </div>
                    <div className="mt-1 flex justify-between border-t-2 border-black pt-1 text-sm font-black">
                      <span>GRAND TOTAL</span>
                      <span>₹740.00</span>
                    </div>
                    {bill.showPaymentDetails && (
                      <div className="flex justify-between pt-0.5 text-[11px]">
                        <span>Paid (UPI)</span>
                        <span>₹740.00</span>
                      </div>
                    )}
                  </div>

                  <div className="my-1 border-t border-black" />
                  <div className="text-center text-[11px] font-semibold">
                    {bill.footerNote?.trim() || "Thank you! Visit again."}
                  </div>
                </div>
              ) : (
                <div className={cn("flex flex-col gap-1.5", previewKotBodyClass)}>
                  <div className={previewKotTitleClass}>KITCHEN ORDER</div>
                  <div className="text-center text-xs font-semibold">
                    {branch?.name ?? "Main Branch"}
                  </div>
                  <div className="text-center text-[11px]">Ticket #1 · Kitchen</div>

                  <div className="my-1 border-t-2 border-black" />

                  {kot.showOrderNumber !== false && (
                    <div className="text-base font-black">#20261116-0001</div>
                  )}
                  <div className="text-sm font-black">
                    DINE IN {kot.showTable !== false && "· Table #3"}
                  </div>
                  {kot.showCustomer !== false && (
                    <div className="text-xs">Guest: Mayank Parmar</div>
                  )}
                  <div className="text-[11px]">16/11/2026, 04:30 PM</div>

                  <div className="my-1 border-t-2 border-black" />

                  <div className="flex flex-col gap-1.5">
                    <div>
                      <div className="text-sm font-black">2 × Paneer Butter Masala</div>
                      {kot.showItemNotes !== false && (
                        <div className="text-xs font-bold text-neutral-800">
                          NOTE: Medium spicy, extra gravy
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-black">4 × Tandoori Roti (Butter)</div>
                      <div className="text-xs text-neutral-700">+ Extra Crisp</div>
                    </div>
                  </div>

                  <div className="my-1 border-t-2 border-black" />
                  <div className="text-xs">2 line(s), 6 item(s)</div>
                </div>
              )}

              {/* Bottom decorative tear */}
              <div className="absolute -bottom-1.5 left-0 right-0 h-1.5 bg-[radial-gradient(ellipse_at_bottom,_transparent_3px,_#fafafa_3px)] bg-[length:8px_6px] bg-repeat-x" />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

