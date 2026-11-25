import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  BulkTableCreateDto,
  FloorDto,
  FloorUpdateDto,
  TableDto,
  TableLayoutUpdateDto,
  TableStatusDto,
  TableUpdateDto,
} from '@nodedr-restaurant/types';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  listFloors(branchId: string) {
    return this.prisma.floor.findMany({
      where: { branchId },
      orderBy: { sortOrder: 'asc' },
      include: {
        tables: {
          include: { assignedWaiter: { select: { id: true, name: true } } },
        },
      },
    });
  }

  createFloor(branchId: string, dto: FloorDto) {
    return this.prisma.floor.create({ data: { ...dto, branchId } });
  }

  async updateFloor(branchId: string, id: string, dto: FloorUpdateDto) {
    await this.assertFloorInBranch(branchId, id);
    return this.prisma.floor.update({ where: { id }, data: dto });
  }

  async deleteFloor(branchId: string, id: string) {
    await this.assertFloorInBranch(branchId, id);
    const openOrdersCount = await this.prisma.order.count({
      where: {
        table: { floorId: id },
        status: 'OPEN',
      },
    });
    if (openOrdersCount > 0) {
      throw new BadRequestException(
        'Cannot delete floor while tables on it have open orders',
      );
    }
    await this.prisma.floor.delete({ where: { id } });
    return { ok: true };
  }

  private boxesOverlap(
    a: { posX: number; posY: number; width: number; height: number },
    b: { posX: number; posY: number; width: number; height: number },
    padding = 10,
  ): boolean {
    return (
      a.posX < b.posX + b.width + padding &&
      a.posX + a.width + padding > b.posX &&
      a.posY < b.posY + b.height + padding &&
      a.posY + a.height + padding > b.posY
    );
  }

  private calculateNextAvailablePositions(
    existingTables: Array<{ posX: number; posY: number; width: number; height: number }>,
    count: number,
    width = 80,
    height = 80,
  ): Array<{ posX: number; posY: number }> {
    const occupied = existingTables.map((t) => ({
      posX: t.posX,
      posY: t.posY,
      width: t.width || 80,
      height: t.height || 80,
    }));

    const positions: Array<{ posX: number; posY: number }> = [];
    const stepX = 120;
    const stepY = 120;
    const colsPerRow = 5;
    let slot = 0;

    for (let i = 0; i < count; i++) {
      while (true) {
        const col = slot % colsPerRow;
        const row = Math.floor(slot / colsPerRow);
        const candidate = {
          posX: 20 + col * stepX,
          posY: 20 + row * stepY,
          width,
          height,
        };
        slot++;

        const collides = occupied.some((other) =>
          this.boxesOverlap(candidate, other),
        );
        if (!collides) {
          positions.push({ posX: candidate.posX, posY: candidate.posY });
          occupied.push(candidate);
          break;
        }
      }
    }

    return positions;
  }

  async createTable(branchId: string, dto: TableDto) {
    await this.assertFloorInBranch(branchId, dto.floorId);

    const width = dto.width ?? 80;
    const height = dto.height ?? 80;
    let posX = dto.posX;
    let posY = dto.posY;

    const existingTables = await this.prisma.table.findMany({
      where: { floorId: dto.floorId },
      select: { posX: true, posY: true, width: true, height: true },
    });

    const isColliding =
      posX === undefined ||
      posY === undefined ||
      (posX === 0 && posY === 0) ||
      (posX === 20 && posY === 20 && existingTables.length > 0) ||
      existingTables.some((t) =>
        this.boxesOverlap(
          { posX: posX!, posY: posY!, width, height },
          { posX: t.posX, posY: t.posY, width: t.width || 80, height: t.height || 80 },
        ),
      );

    if (isColliding) {
      const [freePos] = this.calculateNextAvailablePositions(
        existingTables,
        1,
        width,
        height,
      );
      posX = freePos.posX;
      posY = freePos.posY;
    }

    const table = await this.prisma.table.create({
      data: {
        ...dto,
        posX,
        posY,
        width,
        height,
      },
    });
    this.realtime.emitToBranch(branchId, 'table.updated', table);
    return table;
  }

  async createTables(branchId: string, dto: BulkTableCreateDto) {
    await this.assertFloorInBranch(branchId, dto.floorId);

    const numbers = dto.numbers.map((n) => n.trim()).filter(Boolean);
    const duplicatesInBatch = numbers.filter(
      (n, i) => numbers.indexOf(n) !== i,
    );
    if (duplicatesInBatch.length > 0) {
      throw new BadRequestException(
        `Table numbers must be unique: ${[...new Set(duplicatesInBatch)].join(', ')} ${duplicatesInBatch.length > 1 ? 'are' : 'is'} repeated.`,
      );
    }

    const existing = await this.prisma.table.findMany({
      where: { floorId: dto.floorId, number: { in: numbers } },
      select: { number: true },
    });
    if (existing.length > 0) {
      const clashes = existing.map((t) => t.number).join(', ');
      throw new BadRequestException(
        `These table numbers already exist on this floor: ${clashes}. Choose different numbers.`,
      );
    }

    const existingTables = await this.prisma.table.findMany({
      where: { floorId: dto.floorId },
      select: { posX: true, posY: true, width: true, height: true },
    });

    const positions = this.calculateNextAvailablePositions(
      existingTables,
      numbers.length,
      80,
      80,
    );

    const tables = await this.prisma.$transaction(
      numbers.map((number, index) =>
        this.prisma.table.create({
          data: {
            floorId: dto.floorId,
            number,
            capacity: dto.capacity,
            shape: dto.shape,
            color: dto.color,
            posX: positions[index].posX,
            posY: positions[index].posY,
            width: 80,
            height: 80,
          },
        }),
      ),
    );
    tables.forEach((table) =>
      this.realtime.emitToBranch(branchId, 'table.updated', table),
    );
    return tables;
  }

  async updateTable(branchId: string, id: string, dto: TableUpdateDto) {
    await this.assertTableInBranch(branchId, id);
    const data = { ...dto };
    // Never allow an edit-table form submission without explicit coordinates to reset the table's position
    if (data.posX === undefined) delete data.posX;
    if (data.posY === undefined) delete data.posY;
    if (data.width === undefined) delete data.width;
    if (data.height === undefined) delete data.height;
    if (data.rotation === undefined) delete data.rotation;

    const table = await this.prisma.table.update({ where: { id }, data });
    this.realtime.emitToBranch(branchId, 'table.updated', table);
    return table;
  }

  async updateTableLayout(branchId: string, updates: TableLayoutUpdateDto[]) {
    const owned = await this.prisma.table.findMany({
      where: { id: { in: updates.map((u) => u.id) }, floor: { branchId } },
      select: { id: true },
    });
    if (owned.length !== updates.length) {
      throw new BadRequestException(
        'One or more tables are invalid for this branch',
      );
    }

    const results = await this.prisma.$transaction(
      updates.map(({ id, ...rest }) =>
        this.prisma.table.update({ where: { id }, data: rest }),
      ),
    );
    this.realtime.emitToBranch(branchId, 'table.layout.updated', results);
    return results;
  }

  async updateTableStatus(
    branchId: string,
    id: string,
    status: TableStatusDto,
    assignedWaiterId?: string,
  ) {
    await this.assertTableInBranch(branchId, id);
    // A table with an unpaid bill cannot be marked free/reserved/cleaning by
    // hand - that is how a live order ended up hidden behind an "Available"
    // tile. Pay or cancel the bill first (both release the table themselves).
    if (status !== 'OCCUPIED') {
      const open = await this.prisma.order.findFirst({
        where: { tableId: id, status: 'OPEN' },
        select: { orderNumber: true },
      });
      if (open) {
        throw new ConflictException(
          `This table has an open bill (#${open.orderNumber}) - pay or cancel it first`,
        );
      }
    }
    const table = await this.prisma.table.update({
      where: { id },
      data: {
        status,
        statusSince: new Date(),
        ...(assignedWaiterId ? { assignedWaiterId } : {}),
      },
    });
    this.realtime.emitToBranch(branchId, 'table.updated', table);
    return table;
  }

  async deleteTable(branchId: string, id: string) {
    await this.assertTableInBranch(branchId, id);
    await this.prisma.table.delete({ where: { id } });
    this.realtime.emitToBranch(branchId, 'table.deleted', { id });
    return { ok: true };
  }

  async rotateQrToken(branchId: string, id: string) {
    const table = await this.prisma.table.findFirst({
      where: { id, floor: { branchId } },
    });
    if (!table) throw new NotFoundException('Table not found');

    // opaque, unguessable token — not the table's own id, so a leaked QR
    // image can't be used to enumerate other tables' ids/data
    const qrToken = randomBytes(16).toString('hex');
    return this.prisma.table.update({ where: { id }, data: { qrToken } });
  }

  private async assertFloorInBranch(branchId: string, floorId: string) {
    const floor = await this.prisma.floor.findFirst({
      where: { id: floorId, branchId },
    });
    if (!floor) throw new NotFoundException('Floor not found');
  }

  private async assertTableInBranch(branchId: string, tableId: string) {
    const table = await this.prisma.table.findFirst({
      where: { id: tableId, floor: { branchId } },
    });
    if (!table) throw new NotFoundException('Table not found');
  }

  /** Open guest requests (call waiter / bring bill) for a branch. */
  listOpenRequests(branchId: string) {
    return this.prisma.tableRequest.findMany({
      where: { branchId, resolvedAt: null },
      include: { table: { select: { id: true, number: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async resolveRequest(branchId: string, id: string) {
    const request = await this.prisma.tableRequest.findFirst({
      where: { id, branchId },
    });
    if (!request) throw new NotFoundException('Request not found');
    const updated = await this.prisma.tableRequest.update({
      where: { id },
      data: { resolvedAt: new Date() },
    });
    this.realtime.emitToBranch(branchId, 'table.request', { id });
    return updated;
  }
}
