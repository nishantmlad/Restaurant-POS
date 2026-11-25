import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import type { SessionUser } from '@nodedr-restaurant/types';
import { Auth } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BranchAccessService } from '../../common/services/branch-access.service';
import { uploadsDir } from '../../common/upload/image-upload.config';
import { PrismaService } from '../../prisma/prisma.service';
import { toCsv } from './csv';
import {
  EXPORT_TYPES,
  isExportFormat,
  renderReport,
  type ReportBranding,
} from './export';
import { assertCanViewReport, ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('v1/reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly branchAccess: BranchAccessService,
    private readonly prisma: PrismaService,
  ) {}

  @Auth('reports.access')
  @Get()
  catalog(@CurrentUser() u: SessionUser) {
    return this.reports.catalog(u.permissions);
  }

  @Auth('reports.access')
  @Get(':key')
  async run(
    @CurrentUser() u: SessionUser,
    @Param('key') key: string,
    @Query('branchId') branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    assertCanViewReport(u.permissions, key);
    await this.branchAccess.assertAccess(u.restaurantId, branchId);
    return this.reports.run(key, branchId, from, to);
  }

  // Exporting takes the extra data.export permission on top of viewing.
  @Auth('reports.access', 'data.export')
  @Get(':key/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async csv(
    @CurrentUser() u: SessionUser,
    @Param('key') key: string,
    @Query('branchId') branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    assertCanViewReport(u.permissions, key);
    await this.branchAccess.assertAccess(u.restaurantId, branchId);
    const r = await this.reports.run(key, branchId, from, to);
    return toCsv(r.columns, r.rows);
  }

  // Excel / PDF / CSV through one endpoint. Same permissions as the CSV one.
  @Auth('reports.access', 'data.export')
  @Get(':key/export')
  async export(
    @CurrentUser() u: SessionUser,
    @Param('key') key: string,
    @Query('branchId') branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('format') format = 'xlsx',
    @Res() res: Response,
  ) {
    if (!isExportFormat(format))
      throw new BadRequestException('format must be csv, xlsx or pdf');
    assertCanViewReport(u.permissions, key);
    await this.branchAccess.assertAccess(u.restaurantId, branchId);
    const [r, restaurant, branch] = await Promise.all([
      this.reports.run(key, branchId, from, to),
      this.prisma.restaurant.findUnique({ where: { id: u.restaurantId } }),
      this.prisma.branch.findUnique({ where: { id: branchId } }),
    ]);

    let logoPath: string | null = null;
    if (restaurant?.logoUrl) {
      const filename = basename(restaurant.logoUrl);
      const candidates = [
        join(uploadsDir(), filename),
        join(process.cwd(), 'uploads', filename),
        join(process.cwd(), 'apps', 'backend', 'uploads', filename),
      ];
      logoPath = candidates.find((c) => existsSync(c)) ?? null;
    }

    const branding: ReportBranding = {
      restaurantName: restaurant?.name ?? 'Restaurant POS',
      branchName: branch?.name ?? 'Main Branch',
      address: branch?.address,
      phone: branch?.phone,
      gstNumber: branch?.gstNumber,
      logoPath,
    };

    const body = await renderReport(r, format, `${from} to ${to}`, branding);
    const t = EXPORT_TYPES[format];
    res.setHeader('Content-Type', t.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${key}_${from}_${to}.${t.ext}"`,
    );
    res.send(body);
  }
}
