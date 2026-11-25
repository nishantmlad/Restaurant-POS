import { buildReceiptHtml } from './receipt.html';

const base = {
  restaurantName: 'Bar',
  currency: 'EUR',
  branch: {
    name: 'Centro',
    address: null,
    phone: null,
    gstNumber: null,
    taxRegime: 'ES_IVA' as const,
    taxMode: 'INCLUSIVE' as const,
    taxLabel: null,
    taxId: 'B12345678',
  },
  order: {
    orderNumber: '1',
    type: 'TAKEAWAY',
    createdAt: new Date('2026-10-18T10:00:00Z'),
    table: null,
    customer: null,
    subtotal: 11,
    discountAmount: 0,
    taxAmount: 1,
    tipAmount: 0,
    loyaltyPointsRedeemed: 0,
    loyaltyDiscountAmount: 0,
    totalAmount: 11,
    items: [
      {
        nameSnapshot: 'Paella',
        quantity: 1,
        unitPriceSnapshot: 11,
        lineTotal: 11,
        taxRateSnapshot: 10,
        modifiers: [],
      },
    ],
    payments: [{ method: 'CARD', amount: 11 }],
  },
};
const verifactu = {
  url: 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=B12345678&numserie=T1-000001&fecha=18-10-2026&importe=11.00',
  heading: 'QR tributario:',
  legend: 'Factura verificable en la sede electrónica de la AEAT',
  short: 'VERI*FACTU',
  invoiceNumber: 'T1-000001',
};

describe('receipt HTML with VERI*FACTU', () => {
  it('draws an inline 35 mm QR with the legends on a paid receipt', () => {
    const html = buildReceiptHtml({
      ...base,
      order: { ...base.order, verifactu },
    });
    expect(html).toContain('Factura simplificada T1-000001');
    expect(html).toContain('QR tributario:');
    expect(html).toContain('<svg');
    expect(html).toContain('width="35mm"');
    expect(html).toContain('VERI*FACTU');
  });
  it('omits it without an invoice and on a provisional bill', () => {
    expect(buildReceiptHtml(base)).not.toContain('QR tributario');
    expect(
      buildReceiptHtml({
        ...base,
        order: { ...base.order, verifactu, isProvisional: true },
      }),
    ).not.toContain('QR tributario');
  });

  it('preserves exact 80mm thermal slip format when 80mm is configured', () => {
    const html = buildReceiptHtml({
      ...base,
      template: {
        printerType: 'thermal',
        pageSize: '80mm',
        pageOrientation: 'portrait',
        showLogo: false,
        titleSize: 'large',
        titleStyle: 'bold',
        fontSize: 'normal',
        fontThickness: 'bold',
        fontStyle: 'sans',
        showAddress: true,
        showPhone: true,
        showGstNumber: true,
        showCustomerDetails: true,
        showItemTaxRate: true,
        footerNote: 'Thank you! Visit again.',
      },
    });
    expect(html).toContain('size: 80mm auto');
    expect(html).toContain('width: 80mm');
    expect(html).toContain('class="receipt"');
  });

  it('generates sheet tax invoice for A4 with LED / MFP printers', () => {
    const html = buildReceiptHtml({
      ...base,
      template: {
        printerType: 'mfp',
        pageSize: 'A4',
        pageOrientation: 'portrait',
        showLogo: false,
        titleSize: 'large',
        titleStyle: 'bold',
        fontSize: 'normal',
        fontThickness: 'bold',
        fontStyle: 'sans',
        showAddress: true,
        showPhone: true,
        showGstNumber: true,
        showCustomerDetails: true,
        showItemTaxRate: true,
        footerNote: 'Thank you! Visit again.',
      },
    });
    expect(html).toContain('size: A4 portrait');
    expect(html).toContain('class="sheet-container"');
    expect(html).toContain('TAX INVOICE');
    expect(html).toContain('Authorized Signatory');
  });

  it('generates proportional sheet tax invoice for A5, A6, A7, A1, A2, A3', () => {
    for (const size of ['A1', 'A2', 'A3', 'A5', 'A6', 'A7'] as const) {
      const html = buildReceiptHtml({
        ...base,
        template: {
          printerType: 'led',
          pageSize: size,
          pageOrientation: 'landscape',
          showLogo: false,
          titleSize: 'large',
          titleStyle: 'bold',
          fontSize: 'normal',
          fontThickness: 'bold',
          fontStyle: 'sans',
          showAddress: true,
          showPhone: true,
          showGstNumber: true,
          showCustomerDetails: true,
          showItemTaxRate: true,
          footerNote: 'Thank you! Visit again.',
        },
      });
      expect(html).toContain(`size: ${size} landscape`);
      expect(html).toContain('class="sheet-container"');
      expect(html).toContain('TAX INVOICE');
    }
  });

  it('omits paid, received, change, and balance due fields by default', () => {
    const html = buildReceiptHtml({
      ...base,
      order: {
        ...base.order,
        amountPaid: 11,
        balanceDue: 0,
        payments: [{ method: 'CASH', amount: 11, tendered: 20, changeGiven: 9 }],
      },
    });
    expect(html).not.toContain('Paid (CASH)');
    expect(html).not.toContain('Received');
    expect(html).not.toContain('Change');
    expect(html).not.toContain('Amount paid');
    expect(html).not.toContain('Balance due');
    expect(html).toContain('GRAND TOTAL');
  });

  it('renders payment details only when showPaymentDetails is true', () => {
    const html = buildReceiptHtml({
      ...base,
      order: {
        ...base.order,
        amountPaid: 11,
        balanceDue: 0,
        payments: [{ method: 'CASH', amount: 11, tendered: 20, changeGiven: 9 }],
      },
      template: {
        printerType: 'thermal',
        pageSize: '80mm',
        pageOrientation: 'portrait',
        showLogo: true,
        titleSize: 'large',
        titleStyle: 'bold',
        fontSize: 'normal',
        fontThickness: 'bold',
        fontStyle: 'sans',
        showAddress: true,
        showPhone: true,
        showGstNumber: true,
        showCustomerDetails: true,
        showItemTaxRate: true,
        showPaymentDetails: true,
        footerNote: 'Thank you! Visit again.',
      },
    });
    expect(html).toContain('Paid (CASH)');
    expect(html).toContain('Received');
    expect(html).toContain('Change');
    expect(html).toContain('Amount paid');
    expect(html).toContain('Balance due');
  });

  it('renders logo with solid black filter for crisp thermal printing', () => {
    const html = buildReceiptHtml({
      ...base,
      restaurantLogoUrl: 'https://example.com/logo.png',
      template: {
        printerType: 'thermal',
        pageSize: '80mm',
        pageOrientation: 'portrait',
        showLogo: true,
        titleSize: 'large',
        titleStyle: 'bold',
        fontSize: 'normal',
        fontThickness: 'bold',
        fontStyle: 'sans',
        showAddress: true,
        showPhone: true,
        showGstNumber: true,
        showCustomerDetails: true,
        showItemTaxRate: true,
        footerNote: 'Thank you! Visit again.',
      },
    });
    expect(html).toContain('class="receipt-logo"');
    expect(html).toContain('filter: brightness(0);');
  });
});
