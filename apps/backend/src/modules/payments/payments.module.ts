import { Module } from '@nestjs/common';
import { PaymentGatewayController } from './payment-gateway.controller';
import { PaymentGatewayService } from './payment-gateway.service';
import { OrdersModule } from '../orders/orders.module';
import { PublicModule } from '../public/public.module';

@Module({
  imports: [OrdersModule, PublicModule],
  controllers: [PaymentGatewayController],
  providers: [PaymentGatewayService],
  exports: [PaymentGatewayService],
})
export class PaymentsModule {}
