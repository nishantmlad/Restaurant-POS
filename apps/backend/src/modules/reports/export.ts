import { existsSync } from 'node:fs';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { toCsv, type CsvValue } from './csv';
import type { ReportResult } from './reports.service';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportBranding {
  restaurantName?: string;
  branchName?: string;
  address?: string | null;
  phone?: string | null;
  gstNumber?: string | null;
  logoPath?: string | null;
}

export const EXPORT_TYPES: Record<ExportFormat, { mime: string; ext: string }> =
  {
    csv: { mime: 'text/csv; charset=utf-8', ext: 'csv' },
    xlsx: {
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ext: 'xlsx',
    },
    pdf: { mime: 'application/pdf', ext: 'pdf' },
  };

export function isExportFormat(v: string): v is ExportFormat {
  return v === 'csv' || v === 'xlsx' || v === 'pdf';
}

const FORMULA_START = /^[=+\-@\t\r]/;

function cell(v: CsvValue): string | number | boolean | Date | null {
  if (v == null) return null;
  // Same spreadsheet-injection guard as the CSV writer.
  if (typeof v === 'string' && FORMULA_START.test(v)) return `'${v}`;
  return v;
}

function shouldSumColumn(columnName: string, isNumeric: boolean): boolean {
  if (!isNumeric) return false;
  const lower = columnName.toLowerCase();
  if (
    lower.includes('%') ||
    lower.includes('avg') ||
    lower.includes('rate') ||
    lower.includes('margin') ||
    lower.includes('hour') ||
    lower.includes('day') ||
    lower.includes('month')
  ) {
    return false;
  }
  return true;
}

export async function buildXlsx(
  r: ReportResult,
  subtitle: string,
  branding?: ReportBranding,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = branding?.restaurantName || 'Vetron OrderRestro';
  const ws = wb.addWorksheet(r.title.slice(0, 31));

  // If logo exists, embed in Excel header
  if (branding?.logoPath && existsSync(branding.logoPath)) {
    try {
      const ext = branding.logoPath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
      const imageId = wb.addImage({
        filename: branding.logoPath,
        extension: ext,
      });
      ws.addImage(imageId, {
        tl: { col: 0.1, row: 0.2 },
        ext: { width: 44, height: 44 },
      });
    } catch {
      // Ignore logo embedding failure if image format is unsupported
    }
  }

  // Row 1: Restaurant Name
  const rowRest = ws.addRow([branding?.restaurantName || 'Restaurant POS']);
  rowRest.font = { bold: true, size: 15, color: { argb: 'FF7A1F3D' } };

  // Row 2: Branch & Contact Details
  const branchDetails = [
    branding?.branchName,
    branding?.address,
    branding?.phone ? `Ph: ${branding.phone}` : null,
    branding?.gstNumber ? `GSTIN: ${branding.gstNumber}` : null,
  ]
    .filter(Boolean)
    .join('  •  ');
  if (branchDetails) {
    const rowBranch = ws.addRow([branchDetails]);
    rowBranch.font = { size: 9, color: { argb: 'FF4B5563' } };
  }

  // Row 3: Report Title & Period
  const rowTitle = ws.addRow([`${r.title.toUpperCase()} (Period: ${subtitle})`]);
  rowTitle.font = { bold: true, size: 11, color: { argb: 'FF111827' } };

  // Row 4: Generated timestamp
  const rowMeta = ws.addRow([
    `Generated on: ${new Date().toLocaleString()} • Official Business Report`,
  ]);
  rowMeta.font = { italic: true, size: 8.5, color: { argb: 'FF6B7280' } };

  ws.addRow([]); // Blank spacer

  // Table Headers
  const head = ws.addRow(r.columns);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9.5 };
  head.alignment = { vertical: 'middle' };
  head.eachCell((c) => {
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7A1F3D' },
    };
    c.border = {
      top: { style: 'thin', color: { argb: 'FF7A1F3D' } },
      bottom: { style: 'thin', color: { argb: 'FF7A1F3D' } },
    };
  });

  // Data rows & Total separation
  const isNumeric = r.columns.map((_, colIdx) =>
    r.rows.some((row) => typeof row[colIdx] === 'number'),
  );

  const lastRow = r.rows.length > 0 ? r.rows[r.rows.length - 1] : null;
  const hasBuiltinTotal =
    lastRow != null &&
    String(lastRow[0] ?? '').trim().toLowerCase() === 'total';

  const dataRows = hasBuiltinTotal ? r.rows.slice(0, -1) : r.rows;

  let totalRow: CsvValue[] | null = null;
  if (hasBuiltinTotal && lastRow) {
    totalRow = lastRow;
  } else if (dataRows.length > 1 && isNumeric.some(Boolean)) {
    totalRow = r.columns.map((colName, colIdx) => {
      if (colIdx === 0) return 'Total';
      if (shouldSumColumn(colName, isNumeric[colIdx])) {
        const sum = dataRows.reduce((acc, row) => {
          const v = row[colIdx];
          return acc + (typeof v === 'number' ? v : 0);
        }, 0);
        return Math.round(sum * 100) / 100;
      }
      return '';
    });
  }

  dataRows.forEach((row, rowIndex) => {
    const dataRow = ws.addRow(row.map(cell));
    dataRow.font = { size: 9 };
    const isEven = rowIndex % 2 === 1;
    dataRow.eachCell((c, colIndex) => {
      if (isEven) {
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' },
        };
      }
      c.border = {
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      if (isNumeric[colIndex - 1] && colIndex > 1) {
        c.alignment = { horizontal: 'right' };
      }
    });
  });

  // Single Total summary row
  if (totalRow) {
    const totalRowAdded = ws.addRow(totalRow.map(cell));
    totalRowAdded.font = { bold: true, size: 9.5 };
    totalRowAdded.eachCell((c, colIndex) => {
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      };
      c.border = {
        top: { style: 'medium', color: { argb: 'FF7A1F3D' } },
        bottom: { style: 'double', color: { argb: 'FF7A1F3D' } },
      };
      if (isNumeric[colIndex - 1] && colIndex > 1) {
        c.alignment = { horizontal: 'right' };
      }
    });
  }

  // Autosize columns
  r.columns.forEach((name, i) => {
    const widest = Math.max(
      name.length,
      ...r.rows.slice(0, 200).map((row) => String(row[i] ?? '').length),
    );
    ws.getColumn(i + 1).width = Math.min(48, Math.max(12, widest + 4));
  });

  // Freeze header row
  const headerRowIdx = ws.rowCount - r.rows.length;
  ws.views = [{ state: 'frozen', ySplit: Math.max(1, headerRowIdx) }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function buildPdf(
  r: ReportResult,
  subtitle: string,
  branding?: ReportBranding,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const isLandscape = r.columns.length > 7;
    const doc = new PDFDocument({
      size: 'A4',
      layout: isLandscape ? 'landscape' : 'portrait',
      margin: 36,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width - 72;
    const pageH = doc.page.height;
    const fmt = (v: CsvValue) =>
      v == null
        ? ''
        : v instanceof Date
          ? v.toISOString().slice(0, 10)
          : typeof v === 'number'
            ? String(Math.round(v * 100) / 100)
            : String(v);

    // 1. HEADER SECTION
    const startY = 36;
    let textX = 36;
    const hasLogo = !!(branding?.logoPath && existsSync(branding.logoPath));

    if (hasLogo && branding?.logoPath) {
      try {
        doc.image(branding.logoPath, 36, startY, { fit: [52, 52] });
        textX = 98;
      } catch {
        textX = 36;
      }
    }

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor('#7A1F3D')
      .text(branding?.restaurantName || 'Restaurant POS', textX, startY);

    const branchParts = [branding?.branchName, branding?.address].filter(Boolean);
    if (branchParts.length) {
      doc
        .fontSize(8.5)
        .font('Helvetica')
        .fillColor('#4B5563')
        .text(branchParts.join(' • '), textX, doc.y + 2, {
          width: pageW - (textX - 36) - 140,
        });
    }

    const contactParts = [
      branding?.phone ? `Ph: ${branding.phone}` : null,
      branding?.gstNumber ? `GSTIN: ${branding.gstNumber}` : null,
    ].filter(Boolean);
    if (contactParts.length) {
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text(contactParts.join('   |   '), textX, doc.y + 2);
    }

    // Top Right Meta Box
    const badgeW = 140;
    const badgeX = 36 + pageW - badgeW;
    doc
      .fontSize(8.5)
      .font('Helvetica-Bold')
      .fillColor('#7A1F3D')
      .text('OFFICIAL REPORT', badgeX, startY, {
        width: badgeW,
        align: 'right',
      });
    doc
      .fontSize(7.5)
      .font('Helvetica')
      .fillColor('#6B7280')
      .text(
        `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        badgeX,
        doc.y + 2,
        { width: badgeW, align: 'right' },
      );
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text(`Period: ${subtitle}`, badgeX, doc.y + 2, {
        width: badgeW,
        align: 'right',
      });

    // Divider line
    const headerBottom = Math.max(doc.y, startY + (hasLogo ? 56 : 42)) + 8;
    doc
      .moveTo(36, headerBottom)
      .lineTo(36 + pageW, headerBottom)
      .strokeColor('#E5E7EB')
      .lineWidth(1)
      .stroke();

    // 2. REPORT TITLE BAR
    const titleY = headerBottom + 12;
    doc
      .fontSize(13)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text(r.title.toUpperCase(), 36, titleY);
    doc
      .fontSize(8.5)
      .font('Helvetica')
      .fillColor('#6B7280')
      .text(`Date Range: ${subtitle}`, 36, doc.y + 2);
    doc.y += 10;

    // 3. TABLE SECTION
    const isNumericCol = r.columns.map((_, colIdx) =>
      r.rows.some((row) => typeof row[colIdx] === 'number'),
    );

    const colWeights = r.columns.map((name, i) => {
      const maxValLen = Math.max(
        name.length,
        ...r.rows.slice(0, 50).map((row) => String(row[i] ?? '').length),
      );
      return Math.max(maxValLen, 6);
    });
    const totalWeight = colWeights.reduce((a, b) => a + b, 0);
    const colWidths = colWeights.map((w) => (w / totalWeight) * pageW);
    const colX: number[] = [];
    let curX = 36;
    for (const w of colWidths) {
      colX.push(curX);
      curX += w;
    }

    const drawTableHeader = () => {
      const hY = doc.y;
      const hHeight = 20;
      doc.rect(36, hY, pageW, hHeight).fill('#7A1F3D');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF');
      r.columns.forEach((cName, i) => {
        const align = isNumericCol[i] && i > 0 ? 'right' : 'left';
        doc.text(cName, colX[i] + 4, hY + 5, {
          width: colWidths[i] - 8,
          align,
        });
      });
      doc.y = hY + hHeight;
    };

    drawTableHeader();

    const lastPdfRow = r.rows.length > 0 ? r.rows[r.rows.length - 1] : null;
    const hasBuiltinPdfTotal =
      lastPdfRow != null &&
      String(lastPdfRow[0] ?? '').trim().toLowerCase() === 'total';

    const pdfDataRows = hasBuiltinPdfTotal ? r.rows.slice(0, -1) : r.rows;

    let pdfTotalRow: CsvValue[] | null = null;
    if (hasBuiltinPdfTotal && lastPdfRow) {
      pdfTotalRow = lastPdfRow;
    } else if (pdfDataRows.length > 1 && isNumericCol.some(Boolean)) {
      pdfTotalRow = r.columns.map((colName, colIdx) => {
        if (colIdx === 0) return 'Total';
        if (shouldSumColumn(colName, isNumericCol[colIdx])) {
          const sum = pdfDataRows.reduce((acc, row) => {
            const v = row[colIdx];
            return acc + (typeof v === 'number' ? v : 0);
          }, 0);
          return Math.round(sum * 100) / 100;
        }
        return '';
      });
    }

    const rowH = 18;
    for (let rowIdx = 0; rowIdx < pdfDataRows.length; rowIdx++) {
      if (doc.y + rowH > pageH - 50) {
        doc.addPage();
        drawTableHeader();
      }

      const row = pdfDataRows[rowIdx];
      const curY = doc.y;

      // Alternating background
      if (rowIdx % 2 === 1) {
        doc.rect(36, curY, pageW, rowH).fill('#F9FAFB');
      }

      doc.font('Helvetica').fontSize(8).fillColor('#111827');
      row.forEach((cellVal, j) => {
        const strVal = fmt(cellVal);
        const align = isNumericCol[j] && j > 0 ? 'right' : 'left';
        doc.text(strVal || '—', colX[j] + 4, curY + 5, {
          width: colWidths[j] - 8,
          align,
        });
      });

      // Bottom border
      doc
        .moveTo(36, curY + rowH)
        .lineTo(36 + pageW, curY + rowH)
        .strokeColor('#E5E7EB')
        .lineWidth(0.5)
        .stroke();

      doc.y = curY + rowH;
    }

    // Single Summary Total Row
    if (pdfTotalRow) {
      if (doc.y + rowH > pageH - 50) {
        doc.addPage();
        drawTableHeader();
      }
      const sumY = doc.y;
      doc.rect(36, sumY, pageW, rowH).fill('#F3F4F6');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827');

      pdfTotalRow.forEach((cellVal, j) => {
        const strVal = fmt(cellVal);
        const align = isNumericCol[j] && j > 0 ? 'right' : 'left';
        doc.text(strVal || (j === 0 ? 'Total' : ''), colX[j] + 4, sumY + 5, {
          width: colWidths[j] - 8,
          align,
        });
      });

      doc
        .moveTo(36, sumY)
        .lineTo(36 + pageW, sumY)
        .strokeColor('#7A1F3D')
        .lineWidth(1)
        .stroke();

      doc
        .moveTo(36, sumY + rowH)
        .lineTo(36 + pageW, sumY + rowH)
        .strokeColor('#7A1F3D')
        .lineWidth(1)
        .stroke();

      doc.y = sumY + rowH + 6;
    }

    if (!r.rows.length) {
      doc
        .moveDown(1.5)
        .fontSize(9.5)
        .fillColor('#6B7280')
        .text('No data for this period.', { align: 'center' });
    }

    // 4. FOOTER ON ALL BUFFERED PAGES
    const pageRange = doc.bufferedPageRange();
    const totalPages = pageRange.count;
    for (let p = pageRange.start; p < pageRange.start + totalPages; p++) {
      doc.switchToPage(p);
      const oldBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      const fY = pageH - 24;
      doc
        .moveTo(36, fY - 5)
        .lineTo(36 + pageW, fY - 5)
        .strokeColor('#E5E7EB')
        .lineWidth(0.5)
        .stroke();

      const footerLeft = `${branding?.restaurantName || 'Restaurant POS'}${branding?.branchName ? ` • ${branding.branchName}` : ''} • Confidential Official Report`;
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#9CA3AF')
        .text(footerLeft, 36, fY, {
          width: pageW * 0.75,
          align: 'left',
          lineBreak: false,
        });

      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#9CA3AF')
        .text(`Page ${p + 1} of ${totalPages}`, 36 + pageW * 0.75, fY, {
          width: pageW * 0.25,
          align: 'right',
          lineBreak: false,
        });

      doc.page.margins.bottom = oldBottom;
    }

    doc.end();
  });
}

export async function renderReport(
  r: ReportResult,
  format: ExportFormat,
  subtitle: string,
  branding?: ReportBranding,
): Promise<Buffer> {
  if (format === 'csv') return Buffer.from(toCsv(r.columns, r.rows), 'utf8');
  if (format === 'xlsx') return buildXlsx(r, subtitle, branding);
  return buildPdf(r, subtitle, branding);
}
