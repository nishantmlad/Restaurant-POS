import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { resolveTaxLabel, type KioskOrderDto } from '@nodedr-restaurant/types';
import { Prisma } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { uploadsDir } from '../../common/upload/image-upload.config';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { PublicMenuService } from './public-menu.service';
import { buildReceiptHtml } from '../orders/receipt.html';

const SERVICE_LABEL = { DINE_IN: 'Dine-in', TAKEAWAY: 'Takeaway' } as const;
const MAX_ORDER_ATTEMPTS = 3;

/**
 * Self-service kiosk, reached only through the branch's opaque kioskToken.
 * Deliberately narrow: it can read the customer-visible menu and create one
 * KIOSK order at a time — never read back an order, list orders or touch any
 * staff data. Prices, modifiers and tax are all recomputed by OrdersService
 * (the same code the POS uses); nothing the client sends is trusted for money.
 */
@Injectable()
export class PublicKioskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly publicMenu: PublicMenuService,
  ) {}

  private async resolveBranch(kioskToken: string) {
    // A short/garbage token can never match; avoids a pointless query.
    if (!/^[a-f0-9]{32}$/.test(kioskToken)) {
      throw new NotFoundException('This kiosk is not available');
    }
    const branch = await this.prisma.branch.findUnique({
      where: { kioskToken },
      include: { restaurant: true },
    });
    if (!branch || !branch.isActive) {
      throw new NotFoundException('This kiosk is not available');
    }
    return branch;
  }

  async getMenu(kioskToken: string) {
    const branch = await this.resolveBranch(kioskToken);
    const categories = await this.publicMenu.menuCategoriesForBranch(branch.id);

    let paymentGateway = {
      enabled: false,
      testMode: true,
      autoVerifyKiosk: true,
    };
    try {
      const gwFile = join(uploadsDir(), 'payment-gateway.json');
      if (existsSync(gwFile)) {
        const raw = JSON.parse(readFileSync(gwFile, 'utf8'));
        paymentGateway = {
          enabled: Boolean(raw.enabled),
          testMode: raw.testMode !== false,
          autoVerifyKiosk: raw.autoVerifyKiosk !== false,
        };
      }
    } catch {}

    return {
      restaurantName: branch.restaurant.name,
      branchName: branch.name,
      logoUrl: branch.restaurant.logoUrl ?? null,
      currency: branch.restaurant.currency,
      country: branch.country,
      taxMode: branch.taxMode,
      taxLabel:
        branch.taxLabel &&
        branch.taxLabel !== branch.gstNumber &&
        branch.taxLabel !== branch.taxId &&
        !/^[0-9A-Z]{9,}$/.test(branch.taxLabel)
          ? branch.taxLabel
          : resolveTaxLabel(branch.taxRegime, null),
      services: {
        dineIn: branch.kioskDineInEnabled,
        takeaway: branch.kioskTakeawayEnabled,
      },
      upiVpa: branch.restaurant.upiVpa ?? null,
      upiPayeeName: branch.restaurant.upiPayeeName ?? branch.restaurant.name,
      paymentGateway,
      // Empty categories are not worth a button on a touchscreen.
      categories: categories.filter((c) => c.items.length > 0),
    };
  }

  async getReceiptHtml(kioskToken: string, orderNumber: string): Promise<string> {
    const branch = await this.resolveBranch(kioskToken);
    const order = await this.ordersService.getReceiptDataByNumber(branch.id, orderNumber);

    const totalAmount = Number(order.totalAmount);
    const amountPaid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const balanceDue = Math.max(0, totalAmount - amountPaid);

    const html = buildReceiptHtml({
      restaurantName: branch.restaurant.name,
      restaurantLogoUrl: branch.restaurant.logoUrl,
      currency: branch.restaurant.currency,
      template: (branch.printTemplate as any)?.bill,
      branch: {
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        gstNumber: branch.gstNumber,
        taxRegime: branch.taxRegime,
        taxMode: branch.taxMode,
        taxLabel: branch.taxLabel,
        taxId: branch.taxId,
      },
      order: {
        orderNumber: order.orderNumber,
        type: order.type,
        createdAt: order.createdAt,
        table: order.table ? { label: order.table.name ?? `#${order.table.number}` } : null,
        customer: order.customer ? { name: order.customer.name ?? 'Guest', phone: order.customer.phone } : null,
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        taxAmount: Number(order.taxAmount),
        tipAmount: Number(order.tipAmount),
        loyaltyPointsRedeemed: order.loyaltyPointsRedeemed,
        loyaltyDiscountAmount: Number(order.loyaltyDiscountAmount),
        totalAmount,
        amountPaid,
        balanceDue,
        isProvisional: balanceDue > 0 && order.status !== 'PAID',
        payments: order.payments.map((p) => ({
          method: p.method,
          amount: Number(p.amount),
          reference: p.reference,
          createdAt: p.createdAt,
        })),
        items: order.items.map((item) => ({
          nameSnapshot: item.nameSnapshot,
          quantity: item.quantity,
          unitPriceSnapshot: Number(item.unitPriceSnapshot),
          lineTotal: Number(item.lineTotal),
          taxRateSnapshot: Number(item.taxRateSnapshot),
          modifiers: item.modifiers.map((m) => ({
            nameSnapshot: m.nameSnapshot,
            priceAdjSnapshot: Number(m.priceAdjSnapshot),
          })),
        })),
        verifactu: null,
      },
    });

    return html;
  }

  async printThermalReceipt(kioskToken: string, orderNumber: string) {
    const branch = await this.resolveBranch(kioskToken);
    return this.ordersService.printThermalReceipt(branch.id, orderNumber, true);
  }

  async createOrder(kioskToken: string, dto: KioskOrderDto) {
    const branch = await this.resolveBranch(kioskToken);
    if (
      (dto.serviceType === 'DINE_IN' && !branch.kioskDineInEnabled) ||
      (dto.serviceType === 'TAKEAWAY' && !branch.kioskTakeawayEnabled)
    ) {
      throw new BadRequestException('That service option is not available');
    }

    // Retry of a submit we already completed: hand back the same order.
    const existing = await this.findByRequestId(branch.id, dto.requestId);
    if (existing) return this.present(existing, branch.restaurant.currency);

    await this.assertAvailable(branch.id, dto.items);

    const createdById = await this.resolveActor(branch.id);

    for (let attempt = 1; ; attempt++) {
      try {
        const order = await this.ordersService.createOrder(
          branch.id,
          createdById,
          {
            type: 'KIOSK',
            notes: `Kiosk · ${SERVICE_LABEL[dto.serviceType]}`,
            items: dto.items.map((i) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              modifierIds: i.modifierIds,
            })),
          },
          // ONLINE channel => category visibility + guest modifier limits
          // are enforced. No requireAcceptance: a kiosk order goes straight
          // to the KDS, payment is taken separately at the counter.
          { channel: 'ONLINE', clientRequestId: dto.requestId },
        );
        return this.present(order, branch.restaurant.currency);
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          // Either a concurrent duplicate submit (same requestId) ...
          const dup = await this.findByRequestId(branch.id, dto.requestId);
          if (dup) return this.present(dup, branch.restaurant.currency);
          // ... or two orders racing for the same daily order number.
          if (attempt < MAX_ORDER_ATTEMPTS) continue;
        }
        throw err;
      }
    }
  }

  private findByRequestId(branchId: string, clientRequestId: string) {
    return this.prisma.order.findFirst({
      where: { branchId, clientRequestId },
      include: { items: true },
    });
  }

  /** Items switched off (or removed) since the kiosk loaded its menu. */
  private async assertAvailable(
    branchId: string,
    items: KioskOrderDto['items'],
  ) {
    const ids = [...new Set(items.map((i) => i.menuItemId))];
    const found = await this.prisma.menuItem.findMany({
      where: { id: { in: ids }, branchId },
      select: {
        id: true,
        isActive: true,
        category: { select: { isActive: true } },
      },
    });
    const byId = new Map(found.map((m) => [m.id, m]));
    const unavailable = ids.filter((id) => {
      const m = byId.get(id);
      return !m || !m.isActive || !m.category.isActive;
    });
    if (unavailable.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ITEM_UNAVAILABLE',
        message: 'Some items are no longer available',
        unavailableItemIds: unavailable,
      });
    }
  }

  // Order.createdById is a required FK and a kiosk has no staff login:
  // attribute to the first staff member linked to the branch, exactly as the
  // table-QR flow does when no waiter is assigned.
  private async resolveActor(branchId: string) {
    const link = await this.prisma.userBranch.findFirst({
      where: { branchId },
      orderBy: { userId: 'asc' },
    });
    if (!link) {
      throw new NotFoundException(
        'This branch has no staff to receive the order',
      );
    }
    return link.userId;
  }

  // Only what the confirmation/ticket needs: no ids, no staff, no payments.
  private present(
    order: {
      orderNumber: string;
      dailyToken?: number | null;
      subtotal: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      createdAt: Date;
      notes: string | null;
      items: {
        nameSnapshot: string;
        quantity: number;
        lineTotal: Prisma.Decimal;
      }[];
    },
    currency: string,
  ) {
    return {
      orderNumber: order.orderNumber,
      dailyToken: order.dailyToken ?? null,
      createdAt: order.createdAt,
      currency,
      items: order.items.map((i) => ({
        name: i.nameSnapshot,
        quantity: i.quantity,
        lineTotal: i.lineTotal.toString(),
      })),
      subtotal: order.subtotal.toString(),
      taxAmount: order.taxAmount.toString(),
      totalAmount: order.totalAmount.toString(),
      // Kiosk orders are never paid by the kiosk itself.
      paid: false,
    };
  }
}
