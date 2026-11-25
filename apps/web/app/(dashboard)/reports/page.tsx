"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { hasPermission, useCurrentUser } from "@/hooks/use-auth";
import { useBranch } from "@/hooks/use-branch";
import { useSettings } from "@/hooks/use-settings";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SchedulesPanel } from "@/components/reports/schedules-panel";

interface CatalogEntry {
  key: string;
  title: string;
  group: string;
}
interface ReportResult {
  key: string;
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function ReportsPage() {
  const { branchId } = useBranch();
  const { data: me } = useCurrentUser();
  const { data: settings } = useSettings(branchId);
  const canExport = hasPermission(me?.user, "data.export");
  const [key, setKey] = useState("sales-daily");
  const [range, setRange] = useState(() => ({
    from: iso(new Date(Date.now() - 29 * 86_400_000)),
    to: iso(new Date()),
  }));
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);

  const { data: catalog } = useQuery({
    queryKey: ["reports", "catalog"],
    queryFn: () => api.get<CatalogEntry[]>("/reports"),
  });
  const qs = `branchId=${branchId}&from=${range.from}&to=${range.to}`;
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", key, branchId, range.from, range.to],
    queryFn: () => api.get<ReportResult>(`/reports/${key}?${qs}`),
    enabled: !!branchId && range.from <= range.to,
    retry: false,
  });

  const isNumericCol = useMemo(() => {
    if (!data?.columns || !data?.rows) return [];
    return data.columns.map((_, colIdx) =>
      data.rows.some((row) => typeof row[colIdx] === "number")
    );
  }, [data]);

  const { dataRows, totalRow } = useMemo(() => {
    if (!data?.rows || data.rows.length === 0) {
      return { dataRows: [], totalRow: null };
    }
    const lastRow = data.rows[data.rows.length - 1];
    const hasBuiltinTotal =
      lastRow != null &&
      String(lastRow[0] ?? "").trim().toLowerCase() === "total";

    if (hasBuiltinTotal) {
      return {
        dataRows: data.rows.slice(0, -1),
        totalRow: lastRow,
      };
    }

    if (data.rows.length > 1 && isNumericCol.some(Boolean)) {
      const computedTotal = data.columns.map((colName, colIdx) => {
        if (colIdx === 0) return "Total";
        const lower = colName.toLowerCase();
        const shouldSum =
          isNumericCol[colIdx] &&
          !lower.includes("%") &&
          !lower.includes("avg") &&
          !lower.includes("rate") &&
          !lower.includes("margin") &&
          !lower.includes("hour") &&
          !lower.includes("day") &&
          !lower.includes("month");
        if (shouldSum) {
          const sum = data.rows.reduce((acc, row) => {
            const v = row[colIdx];
            return acc + (typeof v === "number" ? v : 0);
          }, 0);
          return Math.round(sum * 100) / 100;
        }
        return "";
      });
      return { dataRows: data.rows, totalRow: computedTotal };
    }

    return { dataRows: data.rows, totalRow: null };
  }, [data, isNumericCol]);

  const handleDownload = async (format: "xlsx" | "pdf" | "csv") => {
    const reportTitle = catalog?.find((c) => c.key === key)?.title ?? key;
    try {
      setDownloadingFormat(format);
      const label = format === "xlsx" ? "Excel" : format.toUpperCase();
      toast.info(`Preparing ${label} export for ${reportTitle}...`);

      const res = await fetch(`/api/v1/reports/${key}/export?${qs}&format=${format}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(body.message || `Export failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = reportTitle.replace(/[^a-zA-Z0-9_-]/g, "_");
      a.download = `${safeTitle}_${range.from}_to_${range.to}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${label} file downloaded successfully!`);
    } catch (err: any) {
      toast.error(err?.message || `Failed to download ${format.toUpperCase()} export`);
    } finally {
      setDownloadingFormat(null);
    }
  };

  const groups = [...new Set(catalog?.map((c) => c.group))];
  const activeTitle = data?.title ?? catalog?.find((c) => c.key === key)?.title ?? "Report";

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Filter by date, print, export to Excel, PDF or CSV, or email on a schedule</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex flex-col gap-4 print:hidden" aria-label="Reports">
          {groups.map((g) => (
            <div key={g} className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{g}</p>
              {catalog
                ?.filter((c) => c.group === g)
                .map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setKey(c.key)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-left text-sm transition-colors",
                      key === c.key ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-secondary",
                    )}
                  >
                    {c.title}
                  </button>
                ))}
            </div>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border">
              <span className="text-xs text-muted-foreground pl-2 font-medium">From</span>
              <Input type="date" className="w-36 h-8 text-xs bg-background" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
              <span className="text-xs text-muted-foreground font-medium">To</span>
              <Input type="date" className="w-36 h-8 text-xs bg-background" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-9 px-3 gap-1.5 text-sm font-medium"
            >
              <Printer className="h-4 w-4 text-muted-foreground" />
              <span>Print Report</span>
            </Button>

            {canExport && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadingFormat !== null}
                  onClick={() => handleDownload("xlsx")}
                  className="h-9 px-3 gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  title="Download Microsoft Excel (.xlsx) spreadsheet"
                >
                  {downloadingFormat === "xlsx" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span>Export Excel</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadingFormat !== null}
                  onClick={() => handleDownload("pdf")}
                  className="h-9 px-3 gap-1.5 text-sm font-medium text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  title="Download PDF document"
                >
                  {downloadingFormat === "pdf" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                  ) : (
                    <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  )}
                  <span>Export PDF</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadingFormat !== null}
                  onClick={() => handleDownload("csv")}
                  className="h-9 px-3 gap-1.5 text-sm font-medium"
                  title="Download CSV file"
                >
                  {downloadingFormat === "csv" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>Export CSV</span>
                </Button>
              </div>
            )}
          </div>

          <Card className="overflow-x-auto p-6 print:border-none print:shadow-none print:p-0">
            {/* Dedicated clean print-only letterhead header */}
            <div className="hidden print:block mb-6 border-b-2 border-black pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {settings?.restaurant.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={settings.restaurant.logoUrl}
                      alt={settings.restaurant.name}
                      className="h-16 w-16 object-contain rounded-md"
                    />
                  )}
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-black">
                      {settings?.restaurant.name ?? "Restaurant POS"}
                    </h1>
                    <p className="text-sm text-gray-700 font-medium">
                      {settings?.branch.name ?? "Main Branch"}
                      {settings?.branch.address ? ` • ${settings.branch.address}` : ""}
                    </p>
                    <p className="text-xs text-gray-600 font-mono">
                      {[
                        settings?.branch.phone ? `Ph: ${settings.branch.phone}` : null,
                        settings?.branch.gstNumber ? `GSTIN: ${settings.branch.gstNumber}` : null,
                      ]
                        .filter(Boolean)
                        .join("  •  ")}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-600">
                  <p className="font-semibold text-black">OFFICIAL REPORT</p>
                  <p>Date Range: {range.from} to {range.to}</p>
                  <p>Printed: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              <div className="mt-4 pt-2 border-t border-gray-300 flex justify-between items-baseline">
                <h2 className="text-lg font-bold text-black uppercase tracking-wide">{activeTitle}</h2>
                <span className="text-xs text-gray-600">Generated from Vetron OrderRestro</span>
              </div>
            </div>

            {/* Screen-only title */}
            <div className="print:hidden mb-4">
              <h2 className="text-xl font-semibold text-foreground">{activeTitle}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Period: {range.from} to {range.to}
              </p>
            </div>

            {isLoading ? (
              <Skeleton className="h-32" />
            ) : error ? (
              <p className="text-sm text-destructive">{error instanceof ApiError ? error.message : "Could not load report"}</p>
            ) : data && data.rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm print:text-xs">
                  <thead className="text-left text-xs font-semibold text-muted-foreground print:text-black border-b border-border print:border-black">
                    <tr>
                      {data.columns.map((c, colIndex) => {
                        const isNumeric = isNumericCol[colIndex];
                        return (
                          <th
                            key={c}
                            className={cn(
                              "py-2.5 pr-4 font-semibold print:py-1.5",
                              isNumeric && colIndex > 0 ? "text-right" : "text-left"
                            )}
                          >
                            {c}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border print:divide-gray-300">
                    {dataRows.map((r, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors print:hover:bg-transparent">
                        {r.map((cell, j) => {
                          const isNumeric = isNumericCol[j];
                          return (
                            <td
                              key={j}
                              className={cn(
                                "py-2 pr-4 tabular-nums print:py-1.5 print:text-black",
                                isNumeric && j > 0 ? "text-right" : "text-left"
                              )}
                            >
                              {cell ?? "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  {totalRow && (
                    <tfoot className="border-t-2 border-primary/40 bg-muted/30 font-bold print:bg-gray-100 print:border-black">
                      <tr>
                        {totalRow.map((cell, j) => {
                          const isNumeric = isNumericCol[j];
                          return (
                            <td
                              key={j}
                              className={cn(
                                "py-2.5 pr-4 tabular-nums text-foreground print:py-1.5 print:text-black font-bold",
                                isNumeric && j > 0 ? "text-right" : "text-left"
                              )}
                            >
                              {cell ?? "—"}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No data for this period.</p>
            )}

            {/* Print-only footer */}
            <div className="hidden print:flex justify-between items-center text-[10px] text-gray-500 mt-8 pt-2 border-t border-gray-300">
              <span>{settings?.restaurant.name ?? "Restaurant"} — {activeTitle}</span>
              <span>Page 1 • Confidential</span>
            </div>
          </Card>

          {canExport && (
            <div className="print:hidden">
              <SchedulesPanel
                branchId={branchId}
                reportKey={key}
                titles={Object.fromEntries((catalog ?? []).map((c) => [c.key, c.title]))}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
