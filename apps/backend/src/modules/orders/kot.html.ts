// Self-printing HTML kitchen ticket — same iframe+window.print() pattern as
// receipt.html.ts, deliberately a separate template rather than reusing
// buildReceiptHtml with a "hide prices" flag: a KOT is read by kitchen
// staff standing at a station under pressure, not a customer, so it needs
// large type, item names as the loudest thing on the page, and zero price/
// tax noise — different enough from a receipt that a shared template with
// conditionals would be harder to read than two small, honest ones.

import type { KotTemplateDto } from '@nodedr-restaurant/types';

function esc(value: string | number | null | undefined): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

interface KotOrder {
  orderNumber: string;
  type: string;
  createdAt: Date;
  table: { label: string } | null;
  customer: { name: string } | null;
  items: {
    nameSnapshot: string;
    quantity: number;
    kitchenNote: string | null;
    modifiers: { nameSnapshot: string }[];
  }[];
}

export function buildKotHtml({
  branchName,
  order,
  template,
}: {
  branchName: string;
  order: KotOrder;
  template?: KotTemplateDto | null;
}): string {
  const dateStr = new Date(order.createdAt).toLocaleString();
  const showItemNotes = template?.showItemNotes !== false;
  const showTable = template?.showTable !== false;
  const showCustomer = template?.showCustomer !== false;
  const showOrderNumber = template?.showOrderNumber !== false;

  const tTitleSize =
    template?.titleSize === 'xlarge'
      ? '22px'
      : template?.titleSize === 'large'
        ? '18px'
        : '15px';
  const tTitleWeight =
    template?.titleStyle === 'extrabold' ? '900' : '800';
  const tFontSize =
    template?.fontSize === 'xlarge'
      ? '19px'
      : template?.fontSize === 'large'
        ? '16.5px'
        : '14.5px';
  const tFontWeight =
    template?.fontThickness === 'extrabold' ? '800' : '700';

  const itemRows = order.items
    .map((item) => {
      const modifierLines = item.modifiers
        .map((m) => `<div class="sub">+ ${esc(m.nameSnapshot)}</div>`)
        .join('');
      const noteLine =
        showItemNotes && item.kitchenNote
          ? `<div class="note">Note: ${esc(item.kitchenNote)}</div>`
          : '';
      return `
        <tr>
          <td class="qty">${item.quantity}×</td>
          <td>${esc(item.nameSnapshot)}${modifierLines}${noteLine}</td>
        </tr>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>KOT ${esc(order.orderNumber)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html { margin: 0; }
  body { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; margin: 0; padding: 2mm 3mm; color: #000; width: 80mm; font-weight: 600; }
  p { margin: 0 0 3px; color: #000; }
  .kot { width: 100%; margin: 0; }
  h1 { font-size: ${tTitleSize}; font-weight: ${tTitleWeight}; text-align: center; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.5px; color: #000; }
  .center { text-align: center; }
  .muted { color: #000; font-size: 13px; line-height: 1.4; font-weight: 600; }
  .rule { border: none; border-top: 1.5px solid #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; font-size: ${tFontSize}; font-weight: ${tFontWeight}; }
  td { padding: 4px 0; vertical-align: top; word-break: break-word; color: #000; }
  .qty { font-weight: 900; white-space: nowrap; padding-right: 8px; width: 1%; color: #000; }
  .sub { font-size: 13px; color: #000; padding-left: 4px; font-weight: 600; }
  .note { font-size: 13.5px; font-weight: 800; color: #000; padding-left: 4px; }
  @page { size: 80mm auto; margin: 0; }
  @media print {
    html, body { width: 80mm; color: #000 !important; }
    * { color: #000 !important; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <script>
    window.addEventListener('message', function (e) { if (e.data === 'print') window.print(); });
  </script>
  <div class="kot">
    <h1>Kitchen order</h1>
    <p class="center muted">${esc(branchName)}</p>
    <hr class="rule">
    <p class="muted">
      ${esc(dateStr)}<br>
      ${showOrderNumber ? `Order: #${esc(order.orderNumber)} · ${esc(order.type.replace('_', ' '))}` : esc(order.type.replace('_', ' '))}
      ${order.table && showTable ? `<br><strong style="font-size: 16px;">Table: ${esc(order.table.label)}</strong>` : ''}
      ${order.customer && showCustomer ? `<br>Guest: ${esc(order.customer.name)}` : ''}
    </p>
    <hr class="rule">
    <table>
      <tbody>${itemRows}</tbody>
    </table>
    <hr class="rule">
  </div>
</body>
</html>`;
}
