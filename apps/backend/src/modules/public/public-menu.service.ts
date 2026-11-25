import { Injectable, NotFoundException } from '@nestjs/common';
import type { CartItemDto } from '@nodedr-restaurant/types';
import { NotificationsService } from '../../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class PublicMenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private async resolveTable(qrToken: string) {
    const table = await this.prisma.table.findUnique({
      where: { qrToken },
      include: { floor: { include: { branch: true } } },
    });
    if (!table) throw new NotFoundException('This QR code is not recognized');
    return table;
  }

  async getMenuByQrToken(qrToken: string) {
    const table = await this.resolveTable(qrToken);
    const branch = table.floor.branch;
    const categories = await this.menuCategoriesForBranch(branch.id);
    const activeOrders = await this.prisma.order.findMany({
      where: { tableId: table.id, status: { in: ['OPEN', 'BILLED'] } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        orderNumber: true,
        guestName: true,
        status: true,
        createdAt: true,
      },
    });
    const latestOrder = activeOrders[activeOrders.length - 1] ?? null;
    return {
      branchName: branch.name,
      tableName: table.name ?? `Table ${table.number}`,
      tableStatus: table.status,
      categories,
      activeSession: latestOrder
        ? {
            orderId: latestOrder.id,
            orderNumber: latestOrder.orderNumber,
            guestName: latestOrder.guestName,
            status: latestOrder.status,
          }
        : null,
      activeSessions: activeOrders.map((o) => ({
        orderId: o.id,
        orderNumber: o.orderNumber,
        guestName: o.guestName,
        status: o.status,
      })),
    };
  }

  /** Customer-visible menu tree, shared by the table-QR page and the kiosk. */
  menuCategoriesForBranch(branchId: string) {
    return this.prisma.menuCategory.findMany({
      where: { branchId, isActive: true, showOnWebsite: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            price: true,
            taxRatePercent: true,
            isVeg: true,
            isVegan: true,
            spiceLevel: true,
            allergens: true,
            modifierGroups: {
              orderBy: { sortOrder: 'asc' },
              select: {
                modifierGroup: {
                  select: {
                    id: true,
                    name: true,
                    minSelect: true,
                    maxSelect: true,
                    isRequired: true,
                    modifiers: {
                      orderBy: { sortOrder: 'asc' },
                      select: {
                        id: true,
                        name: true,
                        priceAdjustment: true,
                        isDefault: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async createOrder(
    qrToken: string,
    items: CartItemDto[],
    guestName: string,
    options?: { targetOrderId?: string; newTab?: boolean },
  ) {
    const table = await this.resolveTable(qrToken);
    const branchId = table.floor.branchId;

    // Unless customer explicitly requested a brand-new separate tab on this table,
    // append to the target open order or existing open tab.
    if (!options?.newTab) {
      const openOrder = options?.targetOrderId
        ? await this.prisma.order.findFirst({
            where: { id: options.targetOrderId, branchId, tableId: table.id, status: 'OPEN' },
          })
        : await this.prisma.order.findFirst({
            where: { branchId, tableId: table.id, status: 'OPEN' },
            orderBy: { createdAt: 'desc' },
          });

      if (openOrder) {
        if (!openOrder.guestName && guestName) {
          await this.prisma.order.update({
            where: { id: openOrder.id },
            data: { guestName },
          });
        }
        return this.ordersService.addItems(branchId, openOrder.id, items, {
          enforceModifierLimits: true,
          websiteOnly: true,
        });
      }
    }

    // A guest scanning a QR code has no staff account, but Order.createdById
    // is a required FK — attribute the order to whoever is on the floor for
    // this table (assigned waiter), falling back to any staff member linked
    // to the branch (every branch has at least its owner) so this never
    // fails for lack of a "system user" that doesn't otherwise exist.
    const createdById =
      table.assignedWaiterId ??
      (
        await this.prisma.userBranch.findFirst({
          where: { branchId },
          orderBy: { userId: 'asc' },
        })
      )?.userId;
    if (!createdById) {
      throw new NotFoundException(
        'This branch has no staff to receive the order',
      );
    }

    return this.ordersService.createOrder(
      branchId,
      createdById,
      {
        type: 'DINE_IN',
        tableId: table.id,
        guestName,
        items,
      },
      { channel: 'ONLINE' },
    );
  }

  /** Live status of the table's current tab, for the guest's QR page. */
  async getStatus(qrToken: string, orderId?: string) {
    const table = await this.resolveTable(qrToken);
    const activeOrders = await this.prisma.order.findMany({
      where: { tableId: table.id, status: { in: ['OPEN', 'BILLED'] } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        acceptance: true,
        totalAmount: true,
        guestName: true,
        items: {
          select: {
            id: true,
            nameSnapshot: true,
            quantity: true,
            status: true,
          },
        },
      },
    });

    const order = orderId
      ? activeOrders.find((o) => o.id === orderId) ?? null
      : activeOrders[activeOrders.length - 1] ?? null;

    const requests = await this.prisma.tableRequest.findMany({
      where: { tableId: table.id, resolvedAt: null },
      select: { type: true },
    });
    return {
      tableStatus: table.status,
      order,
      activeOrders: activeOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        guestName: o.guestName,
        status: o.status,
        totalAmount: o.totalAmount,
      })),
      openRequests: requests.map((r) => r.type),
    };
  }

  /** "Call waiter" / "Bring the bill". One open request per type per table. */
  async createRequest(qrToken: string, type: 'WAITER' | 'BILL', guestName?: string) {
    const table = await this.resolveTable(qrToken);
    const branchId = table.floor.branchId;
    const existing = await this.prisma.tableRequest.findFirst({
      where: { tableId: table.id, type, resolvedAt: null },
    });
    if (existing) return { ok: true, alreadyRequested: true };

    const request = await this.prisma.tableRequest.create({
      data: { branchId, tableId: table.id, type },
    });
    this.realtime.emitToBranch(branchId, 'table.request', { id: request.id });
    const tableName = table.name ?? `Table ${table.number}`;
    const who = guestName ? `${tableName} (${guestName})` : tableName;
    try {
      await this.notifications.notifyByPermission(branchId, 'tables.manage', {
        type: type === 'BILL' ? 'table.bill' : 'table.waiter',
        title:
          type === 'BILL'
            ? `${who} wants the bill`
            : `${who} needs a waiter`,
        body: 'Requested from the table QR code',
        entity: 'Table',
        entityId: table.id,
      });
    } catch {
      // Best-effort: the request row and live event already exist.
    }
    return { ok: true, alreadyRequested: false };
  }

  async getPublicBranches() {
    return this.prisma.branch.findMany({
      select: {
        id: true,
        name: true,
        restaurant: {
          select: {
            name: true,
            logoUrl: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getOrderStatusDisplay(branchOrToken: string) {
    let branch = await this.prisma.branch.findUnique({
      where: { id: branchOrToken },
      include: { restaurant: true },
    });

    if (!branch && branchOrToken.length === 32) {
      branch = await this.prisma.branch.findFirst({
        where: { kioskToken: branchOrToken },
        include: { restaurant: true },
      });
      if (!branch) {
        const table = await this.prisma.table.findUnique({
          where: { qrToken: branchOrToken },
          include: { floor: { include: { branch: { include: { restaurant: true } } } } },
        });
        if (table) branch = table.floor.branch;
      }
    }

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const branchId = branch.id;
    // Active orders within the last 48 hours (covers overnight shifts & active kitchen tickets)
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60_000);

    // Active KOTs (matches KDS: active cooking tickets not yet SERVED, CANCELLED, or REJECTED)
    const kots = await this.prisma.kot.findMany({
      where: {
        order: {
          branchId,
          status: { notIn: ['CANCELLED'] },
        },
        createdAt: { gte: fortyEightHoursAgo },
        status: { in: ['NEW', 'ACCEPTED', 'PREPARING', 'READY'] },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            dailyToken: true,
            type: true,
            table: { select: { number: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Orders without KOTs (e.g. quick takeaway / counter checkout)
    const nonKotOrders = await this.prisma.order.findMany({
      where: {
        branchId,
        createdAt: { gte: fortyEightHoursAgo },
        kots: { none: {} },
        status: { notIn: ['CANCELLED'] },
        OR: [
          { status: 'OPEN' },
          { status: 'PAID', createdAt: { gte: new Date(Date.now() - 45 * 60_000) } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        dailyToken: true,
        type: true,
        status: true,
        createdAt: true,
        table: { select: { number: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const readyMap = new Map<string, { token: string; orderNumber: string; type: string; table: string | null }>();
    const preparingMap = new Map<string, { token: string; orderNumber: string; type: string; table: string | null }>();

    for (const kot of kots) {
      const order = kot.order;
      const rawToken = order.dailyToken != null
        ? String(order.dailyToken).padStart(4, '0')
        : (order.orderNumber.split('-').pop() || '0001');
      const token = `#${rawToken.replace(/^#/, '')}`;

      const item = {
        token,
        orderNumber: order.orderNumber,
        type: order.type,
        table: order.table ? (order.table.name || `#${order.table.number}`) : null,
      };

      if (kot.status === 'READY') {
        readyMap.set(order.id, item);
        preparingMap.delete(order.id);
      } else if (!readyMap.has(order.id)) {
        preparingMap.set(order.id, item);
      }
    }

    for (const order of nonKotOrders) {
      const rawToken = order.dailyToken != null
        ? String(order.dailyToken).padStart(4, '0')
        : (order.orderNumber.split('-').pop() || '0001');
      const token = `#${rawToken.replace(/^#/, '')}`;

      const item = {
        token,
        orderNumber: order.orderNumber,
        type: order.type,
        table: order.table ? (order.table.name || `#${order.table.number}`) : null,
      };

      if (order.status === 'PAID') {
        readyMap.set(order.id, item);
        preparingMap.delete(order.id);
      } else if (!readyMap.has(order.id)) {
        preparingMap.set(order.id, item);
      }
    }

    return {
      restaurantName: branch.restaurant.name,
      branchName: branch.name,
      logoUrl: branch.restaurant.logoUrl,
      preparing: Array.from(preparingMap.values()),
      ready: Array.from(readyMap.values()),
    };
  }
}
