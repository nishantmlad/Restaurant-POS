import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Auth } from '../../common/decorators/auth.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaymentGatewayService } from './payment-gateway.service';
import { PublicKioskService } from '../public/public-kiosk.service';

@ApiTags('payments')
@Controller('v1')
export class PaymentGatewayController {
  constructor(
    private readonly gateway: PaymentGatewayService,
    private readonly kiosk: PublicKioskService,
  ) {}

  // 1. Settings Endpoints (Authenticated)
  @UseGuards(JwtAuthGuard)
  @Auth('settings.manage')
  @Get('settings/payment-gateway')
  getSettings() {
    return this.gateway.getConfig();
  }

  @UseGuards(JwtAuthGuard)
  @Auth('settings.manage')
  @Patch('settings/payment-gateway')
  updateSettings(
    @Body()
    body: {
      enabled?: boolean;
      provider?: 'RAZORPAY';
      testMode?: boolean;
      keyId?: string;
      keySecret?: string;
      webhookSecret?: string;
      autoVerifyKiosk?: boolean;
    },
  ) {
    return this.gateway.updateConfig(body);
  }

  @UseGuards(JwtAuthGuard)
  @Auth('settings.manage')
  @Post('settings/payment-gateway/test')
  testConnection(@Body() body: { keyId: string; keySecret?: string }) {
    return this.gateway.testConnection(body.keyId, body.keySecret);
  }

  // 2. Public Kiosk Payment Endpoints
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('public/kiosk/:kioskToken/initiate-payment')
  async initiateKioskPayment(
    @Param('kioskToken') kioskToken: string,
    @Body()
    body: {
      serviceType: 'DINE_IN' | 'TAKEAWAY';
      items: Array<{
        menuItemId: string;
        quantity: number;
        modifierIds: string[];
      }>;
      totalAmount: number;
    },
  ) {
    const menu = await this.kiosk.getMenu(kioskToken);
    // Get branchId from menu resolution
    const branch = await (this.kiosk as any).resolveBranch(kioskToken);

    return this.gateway.createKioskPaymentSession({
      branchId: branch.id,
      restaurantName: menu.restaurantName,
      upiVpa: menu.upiVpa,
      serviceType: body.serviceType,
      items: body.items,
      totalAmount: body.totalAmount,
      currency: menu.currency,
    });
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('public/kiosk/:kioskToken/payment-status/:paymentId')
  getKioskPaymentStatus(@Param('paymentId') paymentId: string) {
    return this.gateway.getPaymentStatus(paymentId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('public/kiosk/:kioskToken/simulate-payment/:paymentId')
  simulateKioskPayment(@Param('paymentId') paymentId: string) {
    return this.gateway.markPaymentVerified(paymentId, 'SIMULATED_TEST');
  }

  // 3. Live Razorpay Webhook Endpoint
  @Post('public/webhooks/razorpay')
  async handleRazorpayWebhook(
    @Body() payload: any,
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    if (signature && !this.gateway.verifyWebhookSignature(JSON.stringify(payload), signature)) {
      throw new UnauthorizedException('Invalid Razorpay signature');
    }

    if (payload?.event === 'order.paid' || payload?.event === 'payment.captured') {
      const paymentEntity = payload?.payload?.payment?.entity;
      const orderEntity = payload?.payload?.order?.entity;
      const receipt = orderEntity?.receipt || paymentEntity?.description;
      if (receipt) {
        await this.gateway.markPaymentVerified(
          receipt,
          'RAZORPAY_WEBHOOK',
          paymentEntity?.id,
        );
      }
    }
    return { received: true };
  }
}

