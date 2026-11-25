// Self-printing HTML receipt — ported from nodedr-pos's
// backend/src/lib/receipt.js (same 80mm-thermal-safe layout rules: @page
// margin 0, left-aligned body, box-sizing border-box so 80mm stays 80mm
// after padding). Loaded into a hidden iframe by the frontend
// (lib/print.ts), which calls window.print() itself; the inline script here
// is only a fallback for engines that block that cross-frame call.
//
// Multi-region tax (2026-09-27): which tax rows get shown, and whether the
// top line reads as a tax-inclusive subtotal or a pre-tax one, now follows
// the branch's taxRegime/taxMode — see resolveTaxLabel/resolveTaxIdLabel
// in @nodedr-restaurant/types. This file only changes labels and which
// rows are shown; order.subtotal/taxAmount/totalAmount are unchanged
// (computed once, correctly, in pricing.ts — see its own multi-region
// note) and are never recomputed here.

import { qrSvg } from '../verifactu/verifactu.qr';
import type { ReceiptVerifactu } from './escpos-receipt';
import { existsSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { uploadsDir } from '../../common/upload/image-upload.config';
import {
  resolveTaxIdLabel,
  resolveTaxLabel,
  TAX_REGIME_PRESETS,
  type BillTemplateDto,
  type TaxMode,
  type TaxRegime,
} from '@nodedr-restaurant/types';

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

function esc(value: string | number | null | undefined): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

function findUploadFile(cleanName: string): string | null {
  const candidates = [
    join(uploadsDir(), cleanName),
    join(process.cwd(), 'apps', 'backend', 'uploads', cleanName),
    join(process.cwd(), 'uploads', cleanName),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function resolveLogoDataUri(logoUrl?: string | null): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('data:image/')) return logoUrl;

  try {
    const rawPath = logoUrl.split('?')[0];
    const cleanName = basename(rawPath);
    if (cleanName) {
      const filePath = findUploadFile(cleanName);
      if (filePath) {
        const ext = extname(filePath).toLowerCase();
        const mime =
          ext === '.png'
            ? 'image/png'
            : ext === '.jpg' || ext === '.jpeg'
              ? 'image/jpeg'
              : ext === '.webp'
                ? 'image/webp'
                : ext === '.gif'
                  ? 'image/gif'
                  : 'image/png';
        const base64 = readFileSync(filePath).toString('base64');
        return `data:${mime};base64,${base64}`;
      }
    }
  } catch {
    // fallback to original URL
  }
  return logoUrl;
}

interface ReceiptOrder {
  /** Spain VERI*FACTU invoice QR, printed on a paid receipt. */
  verifactu?: ReceiptVerifactu | null;
  orderNumber: string;
  type: string;
  createdAt: Date;
  table: { label: string } | null;
  customer: { name: string; phone: string | null } | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  tipAmount: number;
  loyaltyPointsRedeemed: number;
  loyaltyDiscountAmount: number;
  totalAmount: number;
  /** Discount as a percentage of the subtotal, printed next to the amount. */
  discountPercent?: number;
  /** A bill handed over before payment: no "paid in full" wording. */
  isProvisional?: boolean;
  /** Applied so far / still owed; printed when set. */
  amountPaid?: number;
  balanceDue?: number;
  items: {
    nameSnapshot: string;
    quantity: number;
    unitPriceSnapshot: number;
    lineTotal: number;
    taxRateSnapshot: number;
    modifiers: { nameSnapshot: string; priceAdjSnapshot: number }[];
  }[];
  payments: {
    method: string;
    amount: number;
    tendered?: number | null;
    changeGiven?: number | null;
  }[];
}

export function buildReceiptHtml({
  restaurantName,
  restaurantLogoUrl,
  branch,
  currency,
  order,
  template,
}: {
  restaurantName: string;
  restaurantLogoUrl?: string | null;
  branch: {
    name: string;
    address: string | null;
    phone: string | null;
    gstNumber: string | null;
    taxRegime: TaxRegime;
    taxMode: TaxMode;
    taxLabel: string | null;
    taxId: string | null;
  };
  currency: string;
  order: ReceiptOrder;
  template?: BillTemplateDto | null;
}): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const money = (n: number) => `${sym}${Number(n).toFixed(2)}`;
  const dateStr = new Date(order.createdAt).toLocaleString();
  const taxLabel = resolveTaxLabel(branch.taxRegime, branch.taxLabel);
  // gstNumber is the pre-multi-region field every India install already
  // has populated; taxId is the new generic one. India falls back to the
  // old field so nothing already printed on file goes blank.
  const taxIdValue =
    branch.taxId ||
    (branch.taxRegime === 'INDIA_GST' ? branch.gstNumber : null);
  const taxIdLabel = resolveTaxIdLabel(branch.taxRegime);

  const tTitleSize =
    template?.titleSize === 'xlarge'
      ? '22px'
      : template?.titleSize === 'large'
        ? '18px'
        : '15px';
  const tTitleWeight =
    template?.titleStyle === 'normal'
      ? '600'
      : template?.titleStyle === 'extrabold'
        ? '900'
        : '800';
  const tFontFamily =
    template?.fontStyle === 'mono'
      ? '"Courier New", Courier, monospace'
      : template?.fontStyle === 'condensed'
        ? '"Arial Narrow", Arial, sans-serif'
        : 'Arial, "Helvetica Neue", Helvetica, sans-serif';
  const tFontSize =
    template?.fontSize === 'small'
      ? '11.5px'
      : template?.fontSize === 'large'
        ? '14.5px'
        : '13px';
  const tTableFontSize =
    template?.fontSize === 'small'
      ? '11px'
      : template?.fontSize === 'large'
        ? '14px'
        : '12.5px';
  const tFontWeight =
    template?.fontThickness === 'normal'
      ? '500'
      : template?.fontThickness === 'extrabold'
        ? '800'
        : '600';
  const showAddress = template?.showAddress !== false;
  const showPhone = template?.showPhone !== false;
  const showGst = template?.showGstNumber !== false;
  const showCustomer = template?.showCustomerDetails !== false;
  const showItemTaxRate = template?.showItemTaxRate !== false;
  const resolvedLogoUrl = resolveLogoDataUri(restaurantLogoUrl);
  const showLogo = Boolean(template?.showLogo && resolvedLogoUrl);
  const showPaymentDetails = template?.showPaymentDetails === true;
  const footerNote =
    template?.footerNote?.trim() ||
    (order.isProvisional
      ? 'Bill only — not a receipt. Payment pending.'
      : 'Thank you! Visit again.');

  const pageSize = template?.pageSize ?? '80mm';
  const isSheet = !['80mm', '58mm'].includes(pageSize);

  if (isSheet) {
    return buildSheetInvoiceHtml({
      restaurantName,
      restaurantLogoUrl: resolvedLogoUrl,
      branch,
      currency,
      order,
      template,
      sym,
      money,
      dateStr,
      taxLabel,
      taxIdValue,
      taxIdLabel,
      tTitleSize,
      tTitleWeight,
      tFontFamily,
      tFontSize,
      tTableFontSize,
      tFontWeight,
      showAddress,
      showPhone,
      showGst,
      showCustomer,
      showItemTaxRate,
      showLogo,
      showPaymentDetails,
      footerNote,
    });
  }

  const thermalWidth = pageSize === '58mm' ? '58mm' : '80mm';
  const thermalBodyPadding = pageSize === '58mm' ? '1.5mm 2mm' : '2mm 3mm';

  const itemRows = order.items
    .map((item) => {
      const modifierLines = item.modifiers
        .map((m) => `<div class="sub">+ ${esc(m.nameSnapshot)}</div>`)
        .join('');
      return `
        <tr>
          <td>${esc(item.nameSnapshot)}${modifierLines}${
            showItemTaxRate && Number(item.taxRateSnapshot) > 0
              ? `<div class="sub">${esc(taxLabel)} @ ${item.taxRateSnapshot}%</div>`
              : ''
          }</td>
          <td class="num">${item.quantity}</td>
          <td class="num">${money(item.unitPriceSnapshot)}</td>
          <td class="num">${money(item.lineTotal)}</td>
        </tr>`;
    })
    .join('');

  const totalRows: [string, string][] = [];
  if (branch.taxMode === 'EXCLUSIVE') {
    // US-style: show the pre-tax subtotal, then add tax as its own line —
    // order.subtotal/taxAmount are unchanged, this only reslices the
    // display (see pricing.ts: the stored subtotal already has tax baked
    // in, exactly like every other regime, so the pre-tax figure the
    // customer expects to see is subtotal - taxAmount).
    totalRows.push(['Subtotal', money(order.subtotal - order.taxAmount)]);
    if (order.discountAmount > 0) {
      totalRows.push([
        order.discountPercent && order.discountPercent > 0
          ? `Discount (${Number(order.discountPercent)}%)`
          : 'Discount',
        `- ${money(order.discountAmount)}`,
      ]);
    }
    if (order.taxAmount > 0) {
      totalRows.push([taxLabel, money(order.taxAmount)]);
    }
  } else {
    totalRows.push(['Subtotal', money(order.subtotal)]);
    if (order.discountAmount > 0) {
      totalRows.push([
        order.discountPercent && order.discountPercent > 0
          ? `Discount (${Number(order.discountPercent)}%)`
          : 'Discount',
        `- ${money(order.discountAmount)}`,
      ]);
    }
    if (order.taxAmount > 0) {
      // Prices are tax-inclusive (see ARCHITECTURE.md) — this is a breakup
      // of tax already inside the total above, not an additional charge.
      if (TAX_REGIME_PRESETS[branch.taxRegime].splitCgstSgst) {
        const half =
          Math.round((order.taxAmount / 2 + Number.EPSILON) * 100) / 100;
        totalRows.push(['CGST (incl.)', money(half)]);
        totalRows.push(['SGST (incl.)', money(order.taxAmount - half)]);
      } else {
        totalRows.push([`${taxLabel} (incl.)`, money(order.taxAmount)]);
      }
    }
  }
  if (order.loyaltyDiscountAmount > 0) {
    totalRows.push([
      `Loyalty (${order.loyaltyPointsRedeemed} pts)`,
      `- ${money(order.loyaltyDiscountAmount)}`,
    ]);
  }
  if (order.tipAmount > 0) {
    totalRows.push(['Tip', money(order.tipAmount)]);
  }

  const paymentRows = showPaymentDetails
    ? order.payments.flatMap((p) => {
        const rows = [
          `<tr><td>Paid (${esc(p.method)})</td><td class="num">${money(p.amount)}</td></tr>`,
        ];
        if (p.tendered != null && p.changeGiven != null && p.changeGiven > 0) {
          rows.push(
            `<tr><td class="sub">&nbsp;&nbsp;Received</td><td class="num sub">${money(p.tendered)}</td></tr>`,
            `<tr><td class="sub">&nbsp;&nbsp;Change</td><td class="num sub">${money(p.changeGiven)}</td></tr>`,
          );
        }
        return rows;
      })
    : [];
  const settlementRows =
    showPaymentDetails &&
    order.amountPaid !== undefined &&
    order.balanceDue !== undefined
      ? `<hr class="rule"><table class="totals">
          <tr><td>Amount paid</td><td class="num">${money(order.amountPaid)}</td></tr>
          <tr class="grand"><td>Balance due</td><td class="num">${money(order.balanceDue)}</td></tr>
        </table>`
      : '';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(order.orderNumber)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html { margin: 0; }
  body {
    font-family: ${tFontFamily};
    margin: 0;
    padding: ${thermalBodyPadding};
    color: #000;
    font-weight: ${tFontWeight};
    font-size: ${tFontSize};
    line-height: 1.3;
    width: ${thermalWidth};
    -webkit-font-smoothing: antialiased;
  }
  p { margin: 0 0 3px; color: #000; }
  .receipt { width: 100%; margin: 0; }
  .logo-wrap { text-align: center; margin-bottom: 4px; }
  .receipt-logo {
    display: block;
    margin: 0 auto;
    max-height: 65px;
    max-width: 175px;
    object-fit: contain;
    filter: brightness(0);
    -webkit-filter: brightness(0);
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
  }
  h1 { font-size: ${tTitleSize}; font-weight: ${tTitleWeight}; text-align: center; margin: 0 0 2px; color: #000; letter-spacing: -0.3px; }
  .tagline { text-align: center; font-size: 11px; font-weight: 500; font-style: italic; margin-bottom: 3px; color: #000; }
  .center { text-align: center; }
  .muted { color: #000; font-size: 12px; font-weight: 600; line-height: 1.35; }
  .rule { border: none; border-top: 1.5px solid #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; font-size: ${tTableFontSize}; }
  th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #000; padding-bottom: 3px; border-bottom: 1.5px solid #000; }
  td { padding: 2px 0; vertical-align: top; word-break: break-word; color: #000; font-weight: ${tFontWeight}; }
  .num { text-align: right; white-space: nowrap; padding-left: 6px; }
  .sub { font-size: 10.5px; color: #000; font-weight: 600; }
  .totals td { padding: 2px 0; font-weight: 600; }
  .grand td { font-weight: 800; font-size: 14.5px; border-top: 2px solid #000; padding-top: 4px; }
  .vf { text-align: center; font-size: 11px; }
  .vf svg { display: block; margin: 4px auto; }
  .footer { text-align: center; margin-top: 8px; font-size: 12px; font-weight: 600; color: #000; }
  @page { size: ${thermalWidth} auto; margin: 0; }
  @media print {
    html, body { width: ${thermalWidth}; color: #000 !important; }
    * { color: #000 !important; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <script>
    window.addEventListener('message', function (e) { if (e.data === 'print') window.print(); });
  </script>
  <div class="receipt">
    ${showLogo ? `<div class="logo-wrap"><img src="${esc(resolvedLogoUrl)}" alt="Logo" class="receipt-logo" /></div>` : ''}
    <h1>${esc(restaurantName)}</h1>
    ${template?.tagline ? `<div class="tagline">${esc(template.tagline)}</div>` : ''}
    <p class="center muted">
      ${esc(branch.name)}${branch.address && showAddress ? `<br>${esc(branch.address)}` : ''}
      ${branch.phone && showPhone ? `<br>Ph: ${esc(branch.phone)}` : ''}
      ${taxIdValue && showGst ? `<br>${esc(taxIdLabel)}: ${esc(taxIdValue)}` : ''}
    </p>
    <hr class="rule">
    <p class="muted">
      ${esc(dateStr)}<br>
      Order: #${esc(order.orderNumber)} · ${esc(order.type.replace('_', ' '))}
      ${order.table ? `<br>Table: ${esc(order.table.label)}` : ''}
      ${order.customer && showCustomer ? `<br>Guest: ${esc(order.customer.name)}${order.customer.phone && showPhone ? ` · ${esc(order.customer.phone)}` : ''}` : ''}
    </p>
    <hr class="rule">
    <table>
      <thead>
        <tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr class="rule">
    <table class="totals">
      ${totalRows.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="num">${esc(v)}</td></tr>`).join('')}
      <tr class="grand"><td>${order.isProvisional ? 'TOTAL DUE' : 'GRAND TOTAL'}</td><td class="num">${money(order.totalAmount)}</td></tr>
    </table>
    ${
      paymentRows.length > 0
        ? `<hr class="rule"><table class="totals">${paymentRows.join('')}</table>`
        : ''
    }
    ${settlementRows}
    ${
      order.verifactu && !order.isProvisional
        ? `<hr class="rule"><div class="vf"><strong>Factura simplificada ${esc(order.verifactu.invoiceNumber)}</strong><div>${esc(order.verifactu.heading)}</div>${qrSvg(order.verifactu.url, '35mm')}<div>${esc(order.verifactu.legend)}</div><strong>${esc(order.verifactu.short)}</strong></div>`
        : ''
    }
    <hr class="rule">
    <p class="footer">${esc(footerNote)}</p>
  </div>
</body>
</html>`;
}

function buildSheetInvoiceHtml({
  restaurantName,
  restaurantLogoUrl,
  branch,
  order,
  template,
  money,
  dateStr,
  taxLabel,
  taxIdValue,
  taxIdLabel,
  tTitleSize,
  tTitleWeight,
  tFontFamily,
  showAddress,
  showPhone,
  showGst,
  showCustomer,
  showLogo,
  showPaymentDetails,
  footerNote,
}: {
  restaurantName: string;
  restaurantLogoUrl?: string | null;
  branch: {
    name: string;
    address: string | null;
    phone: string | null;
    gstNumber: string | null;
    taxRegime: TaxRegime;
    taxMode: TaxMode;
    taxLabel: string | null;
    taxId: string | null;
  };
  currency: string;
  order: ReceiptOrder;
  template?: BillTemplateDto | null;
  sym: string;
  money: (n: number) => string;
  dateStr: string;
  taxLabel: string;
  taxIdValue: string | null;
  taxIdLabel: string;
  tTitleSize: string;
  tTitleWeight: string;
  tFontFamily: string;
  tFontSize: string;
  tTableFontSize: string;
  tFontWeight: string;
  showAddress: boolean;
  showPhone: boolean;
  showGst: boolean;
  showCustomer: boolean;
  showItemTaxRate: boolean;
  showLogo: boolean;
  showPaymentDetails: boolean;
  footerNote: string;
}): string {
  const pageSize = template?.pageSize ?? 'A4';
  const pageOrientation = template?.pageOrientation ?? 'portrait';

  const marginMap: Record<string, string> = {
    A1: '12mm',
    A2: '12mm',
    A3: '10mm',
    A4: '8mm 10mm',
    A5: '6mm 8mm',
    A6: '4mm 6mm',
    A7: '3mm 4mm',
  };
  const sheetMargin = marginMap[pageSize] ?? '8mm 10mm';

  const isSmallSheet = pageSize === 'A6' || pageSize === 'A7';
  const isA7 = pageSize === 'A7';

  const invoiceTitle = order.isProvisional ? 'BILL ESTIMATE / PROVISIONAL' : 'TAX INVOICE';

  const isIndiaGst = branch.taxRegime === 'INDIA_GST';

  const itemRowsHtml = order.items
    .map((item, idx) => {
      const modifierLines = item.modifiers
        .map((m) => `<div class="sub-mod">+ ${esc(m.nameSnapshot)}</div>`)
        .join('');
      const taxRate = Number(item.taxRateSnapshot) || 0;
      const rate = item.unitPriceSnapshot;
      const qty = item.quantity;
      const taxable = item.lineTotal;
      const halfTaxRate = Math.round((taxRate / 2) * 10) / 10;
      const halfTaxAmt = isIndiaGst && taxRate > 0
        ? money((taxable * (taxRate / 100)) / (1 + taxRate / 100) / 2)
        : '-';

      return `
        <tr>
          <td class="center">${idx + 1}</td>
          <td>
            <strong>${esc(item.nameSnapshot)}</strong>
            ${modifierLines}
          </td>
          ${!isSmallSheet ? `<td class="center">996331</td>` : ''}
          <td class="num">${money(rate)}</td>
          <td class="center"><strong>${qty}</strong></td>
          ${!isSmallSheet ? `<td class="num">${money(taxable)}</td>` : ''}
          ${
            isIndiaGst && !isSmallSheet
              ? `<td class="center">${taxRate > 0 ? `${halfTaxRate}%` : '-'}</td>
                 <td class="center">${taxRate > 0 ? `${halfTaxRate}%` : '-'}</td>`
              : ''
          }
          <td class="num"><strong>${money(taxable)}</strong></td>
        </tr>`;
    })
    .join('');

  const paymentModes = order.payments.map((p) => p.method).join(', ') || 'CASH';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(order.orderNumber)} - ${esc(invoiceTitle)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: ${tFontFamily};
    margin: 0;
    padding: ${isSmallSheet ? '4px' : '10px'};
    color: #000;
    background: #fff;
    -webkit-font-smoothing: antialiased;
    font-size: ${isA7 ? '9px' : isSmallSheet ? '10px' : '12px'};
    line-height: 1.35;
  }
  @page {
    size: ${pageSize} ${pageOrientation};
    margin: ${sheetMargin};
  }
  @media print {
    html, body { width: 100%; color: #000 !important; background: #fff !important; }
    .no-print { display: none; }
  }

  .sheet-container {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    border: 1.5px solid #000;
    padding: ${isSmallSheet ? '6px' : '12px'};
    background: #fff;
  }

  /* Header Section */
  .header-grid {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1.5px solid #000;
    padding-bottom: ${isSmallSheet ? '6px' : '10px'};
    gap: 12px;
  }
  .brand-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .brand-logo-wrap {
    margin-bottom: 4px;
  }
  .brand-logo {
    max-height: ${isSmallSheet ? '36px' : '54px'};
    max-width: 140px;
    object-fit: contain;
  }
  h1 {
    font-size: ${isA7 ? '13px' : isSmallSheet ? '15px' : tTitleSize};
    font-weight: ${tTitleWeight};
    margin: 0;
    color: #000;
    line-height: 1.2;
    text-transform: uppercase;
    letter-spacing: -0.2px;
  }
  .tagline {
    font-size: ${isA7 ? '8px' : '11px'};
    font-style: italic;
    color: #333;
  }
  .branch-info {
    font-size: ${isA7 ? '8px' : isSmallSheet ? '9.5px' : '11px'};
    color: #222;
    line-height: 1.35;
    margin-top: 3px;
  }
  .gst-badge {
    font-weight: 700;
    color: #000;
  }

  .invoice-meta-col {
    min-width: ${isSmallSheet ? '120px' : '220px'};
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    text-align: right;
  }
  .invoice-title-pill {
    background: #000;
    color: #fff;
    font-weight: 800;
    font-size: ${isA7 ? '9px' : isSmallSheet ? '11px' : '13px'};
    padding: 3px 8px;
    border-radius: 3px;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
    text-transform: uppercase;
    display: inline-block;
  }
  .meta-table {
    font-size: ${isA7 ? '8px' : isSmallSheet ? '9.5px' : '11.5px'};
    border-collapse: collapse;
  }
  .meta-table td {
    padding: 1px 4px;
    vertical-align: top;
  }
  .meta-label {
    font-weight: 600;
    color: #444;
  }
  .meta-val {
    font-weight: 700;
    color: #000;
  }

  /* Customer Details Subheader */
  .guest-strip {
    display: flex;
    justify-content: space-between;
    padding: ${isSmallSheet ? '3px 0' : '6px 0'};
    border-bottom: 1px solid #000;
    font-size: ${isA7 ? '8px' : isSmallSheet ? '9.5px' : '11.5px'};
    background: #fafafa;
    padding-inline: 4px;
  }

  /* Items Table */
  table.items-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: ${isSmallSheet ? '4px' : '8px'};
    font-size: ${isA7 ? '8px' : isSmallSheet ? '9.5px' : '11.5px'};
  }
  table.items-table th {
    background: #f0f0f0;
    color: #000;
    border: 1px solid #000;
    padding: ${isSmallSheet ? '3px 4px' : '5px 6px'};
    font-weight: 800;
    text-transform: uppercase;
    font-size: ${isA7 ? '7.5px' : isSmallSheet ? '9px' : '11px'};
  }
  table.items-table td {
    border: 1px solid #ccc;
    padding: ${isSmallSheet ? '3px 4px' : '4px 6px'};
    vertical-align: top;
  }
  .sub-mod {
    font-size: 85%;
    color: #555;
    font-weight: 500;
  }
  .center { text-align: center; }
  .num { text-align: right; white-space: nowrap; }

  /* Summary & Total Grid */
  .bottom-grid {
    display: flex;
    justify-content: space-between;
    border-top: 1.5px solid #000;
    margin-top: ${isSmallSheet ? '6px' : '10px'};
    padding-top: ${isSmallSheet ? '4px' : '8px'};
    gap: 12px;
  }
  .bottom-left {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: ${isA7 ? '8px' : isSmallSheet ? '9px' : '11px'};
  }
  .terms-box {
    border: 1px dashed #777;
    padding: 4px 6px;
    background: #fafafa;
    border-radius: 3px;
  }
  .terms-title {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 90%;
    margin-bottom: 2px;
  }
  .terms-list {
    margin: 0;
    padding-left: 14px;
    color: #333;
  }
  .bottom-right {
    min-width: ${isSmallSheet ? '140px' : '240px'};
  }
  .totals-table {
    width: 100%;
    border-collapse: collapse;
    font-size: ${isA7 ? '8.5px' : isSmallSheet ? '10px' : '12px'};
  }
  .totals-table td {
    padding: 2px 4px;
  }
  .totals-table .grand-row td {
    background: #000;
    color: #fff !important;
    font-weight: 900;
    font-size: ${isA7 ? '10px' : isSmallSheet ? '12px' : '15px'};
    padding: 4px 6px;
  }
  .totals-table .grand-row td span {
    color: #fff !important;
  }

  /* Signatory */
  .signatory-box {
    margin-top: ${isSmallSheet ? '10px' : '24px'};
    text-align: right;
    font-size: ${isA7 ? '8px' : '11px'};
    font-weight: 600;
  }
  .signatory-line {
    border-top: 1px solid #000;
    display: inline-block;
    width: 140px;
    margin-top: 25px;
    text-align: center;
    padding-top: 2px;
  }
  .footer-note-sheet {
    text-align: center;
    margin-top: 8px;
    border-top: 1px dotted #ccc;
    padding-top: 4px;
    font-weight: 600;
    font-size: ${isA7 ? '8px' : '10.5px'};
  }
</style>
</head>
<body>
  <script>
    window.addEventListener('message', function (e) { if (e.data === 'print') window.print(); });
  </script>
  <div class="sheet-container">
    <!-- Header -->
    <div class="header-grid">
      <div class="brand-col">
        ${showLogo && restaurantLogoUrl ? `<div class="brand-logo-wrap"><img src="${esc(restaurantLogoUrl)}" alt="Logo" class="brand-logo" /></div>` : ''}
        <h1>${esc(restaurantName)}</h1>
        ${template?.tagline ? `<div class="tagline">${esc(template.tagline)}</div>` : ''}
        <div class="branch-info">
          <strong>${esc(branch.name)}</strong>${branch.address && showAddress ? `<br>${esc(branch.address)}` : ''}
          ${branch.phone && showPhone ? `<br>Ph: ${esc(branch.phone)}` : ''}
          ${taxIdValue && showGst ? `<br><span class="gst-badge">${esc(taxIdLabel)}: ${esc(taxIdValue)}</span>` : ''}
        </div>
      </div>
      <div class="invoice-meta-col">
        <div class="invoice-title-pill">${esc(invoiceTitle)}</div>
        <table class="meta-table">
          <tr><td class="meta-label">Invoice No:</td><td class="meta-val">#${esc(order.orderNumber)}</td></tr>
          <tr><td class="meta-label">Date &amp; Time:</td><td class="meta-val">${esc(dateStr)}</td></tr>
          <tr><td class="meta-label">Order Type:</td><td class="meta-val">${esc(order.type.replace('_', ' '))}</td></tr>
          ${order.table ? `<tr><td class="meta-label">Table:</td><td class="meta-val">${esc(order.table.label)}</td></tr>` : ''}
          ${showPaymentDetails ? `<tr><td class="meta-label">Payment:</td><td class="meta-val">${esc(paymentModes)}</td></tr>` : ''}
        </table>
      </div>
    </div>

    <!-- Customer details bar -->
    ${
      showCustomer && order.customer
        ? `<div class="guest-strip">
            <div><strong>Guest:</strong> ${esc(order.customer.name)}</div>
            ${order.customer.phone && showPhone ? `<div><strong>Phone:</strong> ${esc(order.customer.phone)}</div>` : ''}
            <div><strong>Status:</strong> ${order.isProvisional ? 'Payment Pending' : 'Paid in Full'}</div>
          </div>`
        : ''
    }

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th class="center" style="width: 28px;">#</th>
          <th>Item Description</th>
          ${!isSmallSheet ? `<th class="center" style="width: 65px;">HSN/SAC</th>` : ''}
          <th class="num" style="width: 70px;">Rate</th>
          <th class="center" style="width: 45px;">Qty</th>
          ${!isSmallSheet ? `<th class="num" style="width: 80px;">Taxable</th>` : ''}
          ${
            isIndiaGst && !isSmallSheet
              ? `<th class="center" style="width: 48px;">CGST</th>
                 <th class="center" style="width: 48px;">SGST</th>`
              : ''
          }
          <th class="num" style="width: 85px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRowsHtml}
      </tbody>
    </table>

    <!-- Totals and Summary Section -->
    <div class="bottom-grid">
      <div class="bottom-left">
        <div class="terms-box">
          <div class="terms-title">Terms &amp; Conditions</div>
          <ol class="terms-list">
            <li>Goods once sold will not be taken back or exchanged.</li>
            <li>Subject to local jurisdiction. Computer generated invoice.</li>
          </ol>
        </div>
        ${
          order.verifactu && !order.isProvisional
            ? `<div class="vf"><strong>Factura simplificada ${esc(order.verifactu.invoiceNumber)}</strong>${qrSvg(order.verifactu.url, '28mm')}</div>`
            : ''
        }
      </div>

      <div class="bottom-right">
        <table class="totals-table">
          <tr><td>Subtotal:</td><td class="num">${money(order.subtotal)}</td></tr>
          ${
            order.discountAmount > 0
              ? `<tr><td>Discount ${order.discountPercent ? `(${order.discountPercent}%)` : ''}:</td><td class="num">- ${money(order.discountAmount)}</td></tr>`
              : ''
          }
          ${
            order.taxAmount > 0
              ? isIndiaGst
                ? `<tr><td>CGST (incl.):</td><td class="num">${money(order.taxAmount / 2)}</td></tr>
                   <tr><td>SGST (incl.):</td><td class="num">${money(order.taxAmount / 2)}</td></tr>`
                : `<tr><td>${esc(taxLabel)} (incl.):</td><td class="num">${money(order.taxAmount)}</td></tr>`
              : ''
          }
          ${order.tipAmount > 0 ? `<tr><td>Tip:</td><td class="num">${money(order.tipAmount)}</td></tr>` : ''}
          ${order.loyaltyDiscountAmount > 0 ? `<tr><td>Loyalty Discount:</td><td class="num">- ${money(order.loyaltyDiscountAmount)}</td></tr>` : ''}
          <tr class="grand-row">
            <td><span>${order.isProvisional ? 'TOTAL DUE' : 'GRAND TOTAL'}</span></td>
            <td class="num"><span>${money(order.totalAmount)}</span></td>
          </tr>
          ${
            showPaymentDetails &&
            order.amountPaid !== undefined &&
            order.balanceDue !== undefined
              ? `<tr><td>Amount Paid:</td><td class="num">${money(order.amountPaid)}</td></tr>
                 <tr><td><strong>Balance Due:</strong></td><td class="num"><strong>${money(order.balanceDue)}</strong></td></tr>`
              : ''
          }
        </table>

        <div class="signatory-box">
          <div>For <strong>${esc(restaurantName)}</strong></div>
          <div class="signatory-line">Authorized Signatory</div>
        </div>
      </div>
    </div>

    <!-- Footer Note -->
    <div class="footer-note-sheet">${esc(footerNote)}</div>
  </div>
</body>
</html>`;
}
