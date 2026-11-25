import { Body, Controller, Get, Param, Post, Res, UsePipes } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { kioskOrderSchema, type KioskOrderDto } from '@nodedr-restaurant/types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PublicKioskService } from './public-kiosk.service';

// Deliberately unauthenticated — the customer-facing self-service kiosk.
// Only reachable by the opaque per-branch kioskToken (Settings > Kiosk) and
// limited to reading the public menu and creating one order at a time.
@ApiTags('public')
@Controller('v1/public/kiosk')
export class PublicKioskController {
  constructor(private readonly kiosk: PublicKioskService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(':kioskToken')
  getMenu(@Param('kioskToken') kioskToken: string) {
    return this.kiosk.getMenu(kioskToken);
  }

  // A kiosk is one shared device, so this is looser than the per-guest QR
  // limit, but still bounded: this creates real kitchen tickets.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':kioskToken/order')
  @UsePipes(new ZodValidationPipe(kioskOrderSchema))
  createOrder(@Param('kioskToken') kioskToken: string, @Body() body: unknown) {
    return this.kiosk.createOrder(kioskToken, body as KioskOrderDto);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':kioskToken/receipt/:orderNumber')
  async getReceipt(
    @Param('kioskToken') kioskToken: string,
    @Param('orderNumber') orderNumber: string,
    @Res() res: Response,
  ) {
    const html = await this.kiosk.getReceiptHtml(kioskToken, orderNumber);
    res.type('html').send(html);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':kioskToken/print/:orderNumber')
  async printReceipt(
    @Param('kioskToken') kioskToken: string,
    @Param('orderNumber') orderNumber: string,
  ) {
    return this.kiosk.printThermalReceipt(kioskToken, orderNumber);
  }
}
