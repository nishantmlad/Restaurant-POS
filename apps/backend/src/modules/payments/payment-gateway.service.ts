import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Razorpay from 'razorpay';
import { createHmac } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { uploadsDir } from '../../common/upload/image-upload.config';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

export interface PaymentGatewayConfig {
  enabled: boolean;
  provider: 'RAZORPAY';
  testMode: boolean;
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
  autoVerifyKiosk: boolean;
}

export interface PendingKioskPayment {
  paymentId: string;
  branchId: string;
  amount: number;
  currency: string;
  serviceType: 'DINE_IN' | 'TAKEAWAY';
  items: Array<{
    menuItemId: string;
    quantity: number;
    modifierIds: string[];
  }>;
  upiUri: string;
  razorpayOrderId?: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED';
  orderNumber?: string;
  confirmation?: {
    orderNumber: string;
    createdAt: string;
    currency: string;
    items: { name: string; quantity: number; lineTotal: string }[];
    subtotal: string;
    taxAmount: string;
    totalAmount: string;
    paid: boolean;
    serviceType: 'DINE_IN' | 'TAKEAWAY';
  };
  createdAt: number;
  expiresAt: number;
}

const DEFAULT_CONFIG: PaymentGatewayConfig = {
  enabled: false,
  provider: 'RAZORPAY',
  testMode: true,
  autoVerifyKiosk: true,
};

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);
  private configCache: PaymentGatewayConfig | null = null;
  private readonly pendingPayments = new Map<string, PendingKioskPayment>();

  constructor(
    private readonly ordersService: OrdersService,
    private readonly realtime: RealtimeGateway,
    private readonly prisma: PrismaService,
  ) {
    this.cleanExpiredSessions();
    setInterval(() => this.cleanExpiredSessions(), 30_000);
  }

  private getConfigPath(): string {
    const dir = uploadsDir();
    return join(dir, 'payment-gateway.json');
  }

  getRawConfig(): PaymentGatewayConfig {
    if (this.configCache) return this.configCache;
    const file = this.getConfigPath();
    if (existsSync(file)) {
      try {
        const raw = JSON.parse(readFileSync(file, 'utf8'));
        this.configCache = { ...DEFAULT_CONFIG, ...raw };
        return this.configCache!;
      } catch (err) {
        this.logger.error('Failed to read payment-gateway.json:', err);
      }
    }
    this.configCache = { ...DEFAULT_CONFIG };
    return this.configCache;
  }

  getRazorpayClient(customKeyId?: string, customKeySecret?: string): Razorpay | null {
    const raw = this.getRawConfig();
    const id = customKeyId || raw.keyId;
    const secret =
      customKeySecret && !customKeySecret.includes('••••')
        ? customKeySecret
        : raw.keySecret;

    if (!id || !secret) {
      return null;
    }

    return new Razorpay({
      key_id: id,
      key_secret: secret,
    });
  }

  getConfig() {
    const raw = this.getRawConfig();
    return {
      enabled: raw.enabled,
      provider: raw.provider,
      testMode: raw.testMode,
      keyId: raw.keyId ?? '',
      hasKeySecret: Boolean(raw.keySecret && raw.keySecret.length > 0),
      keySecretMasked: raw.keySecret
        ? `••••••••${raw.keySecret.slice(-4)}`
        : '',
      hasWebhookSecret: Boolean(raw.webhookSecret && raw.webhookSecret.length > 0),
      webhookSecretMasked: raw.webhookSecret
        ? `••••••••${raw.webhookSecret.slice(-4)}`
        : '',
      autoVerifyKiosk: raw.autoVerifyKiosk,
    };
  }

  updateConfig(dto: {
    enabled?: boolean;
    provider?: 'RAZORPAY';
    testMode?: boolean;
    keyId?: string;
    keySecret?: string;
    webhookSecret?: string;
    autoVerifyKiosk?: boolean;
  }) {
    const current = this.getRawConfig();
    const next: PaymentGatewayConfig = {
      ...current,
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.provider ? { provider: dto.provider } : {}),
      ...(dto.testMode !== undefined ? { testMode: dto.testMode } : {}),
      ...(dto.keyId !== undefined ? { keyId: dto.keyId.trim() } : {}),
      ...(dto.autoVerifyKiosk !== undefined
        ? { autoVerifyKiosk: dto.autoVerifyKiosk }
        : {}),
    };

    if (dto.keySecret && dto.keySecret.trim() && !dto.keySecret.includes('••••')) {
      next.keySecret = dto.keySecret.trim();
    }
    if (dto.webhookSecret && dto.webhookSecret.trim() && !dto.webhookSecret.includes('••••')) {
      next.webhookSecret = dto.webhookSecret.trim();
    }

    const file = this.getConfigPath();
    writeFileSync(file, JSON.stringify(next, null, 2), 'utf8');
    this.configCache = next;
    return this.getConfig();
  }

  async testConnection(keyId: string, keySecret?: string) {
    const client = this.getRazorpayClient(keyId, keySecret);
    if (!client) {
      throw new BadRequestException('Key ID and Key Secret are required to test connection');
    }

    try {
      // Test credential validity by fetching orders with count 1
      await client.orders.all({ count: 1 });
      return {
        success: true,
        message: 'Connection successful! Your Razorpay credentials are valid.',
      };
    } catch (err: any) {
      const description =
        err?.error?.description ||
        err?.message ||
        'Connection failed: Invalid Razorpay credentials';
      return {
        success: false,
        message: description,
      };
    }
  }

  async createKioskPaymentSession(params: {
    branchId: string;
    restaurantName: string;
    upiVpa?: string | null;
    serviceType: 'DINE_IN' | 'TAKEAWAY';
    items: Array<{
      menuItemId: string;
      quantity: number;
      modifierIds: string[];
    }>;
    totalAmount: number;
    currency: string;
  }) {
    const config = this.getRawConfig();
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = Date.now() + 180_000; // 3 minutes

    let upiUri = '';
    let razorpayOrderId: string | undefined;

    const rzp = this.getRazorpayClient();
    if (config.enabled && rzp) {
      try {
        const order = await rzp.orders.create({
          amount: Math.round(params.totalAmount * 100), // in paise
          currency: params.currency || 'INR',
          receipt: paymentId,
          notes: {
            type: 'KIOSK',
            serviceType: params.serviceType,
          },
        });
        if (order?.id) {
          razorpayOrderId = order.id;
        }
      } catch (err) {
        this.logger.warn('Failed to create Razorpay order with SDK; falling back to intent QR:', err);
      }
    }

    // Dynamic UPI URI per NPCI specification
    const vpa = params.upiVpa || 'merchant@razorpay';
    const payee = encodeURIComponent(params.restaurantName || 'Restaurant');
    const amt = params.totalAmount.toFixed(2);
    const note = encodeURIComponent(`Kiosk Order ${paymentId.slice(-6)}`);
    upiUri = `upi://pay?pa=${vpa}&pn=${payee}&am=${amt}&cu=INR&tn=${note}&tr=${paymentId}`;

    const session: PendingKioskPayment = {
      paymentId,
      branchId: params.branchId,
      amount: params.totalAmount,
      currency: params.currency,
      serviceType: params.serviceType,
      items: params.items,
      upiUri,
      razorpayOrderId,
      status: 'PENDING',
      createdAt: Date.now(),
      expiresAt,
    };

    this.pendingPayments.set(paymentId, session);

    return {
      paymentId,
      upiUri,
      amount: params.totalAmount,
      currency: params.currency,
      expiresAt,
      isTestMode: config.testMode,
      gatewayEnabled: config.enabled,
    };
  }

  async getPaymentStatus(paymentId: string) {
    const session = this.pendingPayments.get(paymentId);
    if (!session) {
      return { status: 'NOT_FOUND' };
    }
    if (Date.now() > session.expiresAt && session.status === 'PENDING') {
      session.status = 'EXPIRED';
    }

    // Auto-check Razorpay API if an order was created and session is still pending
    if (session.status === 'PENDING' && session.razorpayOrderId) {
      const rzp = this.getRazorpayClient();
      if (rzp) {
        try {
          const payments = await rzp.orders.fetchPayments(session.razorpayOrderId);
          const captured = (payments?.items || []).find(
            (p: any) => p.status === 'captured' || p.status === 'authorized',
          );
          if (captured) {
            await this.markPaymentVerified(paymentId, 'RAZORPAY_ORDER_API', captured.id);
          }
        } catch {
          // Polling failsafe - leave session status as PENDING
        }
      }
    }

    return {
      status: session.status,
      orderNumber: session.orderNumber,
      amount: session.amount,
      confirmation: session.confirmation,
    };
  }

  private async resolveActor(branchId: string) {
    const link = await this.prisma.userBranch.findFirst({
      where: { branchId },
      orderBy: { userId: 'asc' },
    });
    if (!link) {
      throw new NotFoundException('This branch has no staff to receive the order');
    }
    return link.userId;
  }

  async markPaymentVerified(
    paymentId: string,
    verificationSource = 'SIMULATED',
    txnRef?: string,
  ) {
    const session = this.pendingPayments.get(paymentId);
    if (!session) {
      throw new NotFoundException('Payment session not found or already completed');
    }

    if (session.status === 'PAID') {
      return {
        status: 'PAID',
        orderNumber: session.orderNumber,
        confirmation: session.confirmation,
      };
    }

    const createdById = await this.resolveActor(session.branchId);

    // Create the actual paid order in OrdersService
    const createdOrder = await this.ordersService.createOrder(
      session.branchId,
      createdById,
      {
        type: 'KIOSK',
        notes: `Kiosk · ${session.serviceType} (Paid via UPI: ${txnRef || verificationSource})`,
        items: session.items,
      },
      { channel: 'ONLINE', clientRequestId: paymentId },
    );

    // Record the payment in the DB so POS shows PAID with 0 balance due
    try {
      await this.ordersService.checkout(
        session.branchId,
        createdOrder.id,
        createdById,
        {
          payments: [
            {
              method: 'UPI',
              amount: session.amount,
              reference: txnRef || `RZP_${paymentId}`,
            },
          ],
          requestId: paymentId,
        },
      );
    } catch (err) {
      this.logger.warn('Auto-checkout order record payment error:', err);
    }

    const confirmation = {
      orderNumber: createdOrder.orderNumber,
      dailyToken: createdOrder.dailyToken ?? null,
      createdAt: createdOrder.createdAt.toISOString(),
      currency: session.currency,
      items: (createdOrder.items || []).map((i: any) => ({
        name: i.nameSnapshot || 'Item',
        quantity: i.quantity,
        lineTotal: String(i.lineTotal),
      })),
      subtotal: String(createdOrder.subtotal),
      taxAmount: String(createdOrder.taxAmount),
      totalAmount: String(createdOrder.totalAmount),
      paid: true,
      serviceType: session.serviceType,
    };

    session.status = 'PAID';
    session.orderNumber = createdOrder.orderNumber;
    session.confirmation = confirmation;

    // Realtime notification to KDS and POS
    this.realtime.emitToBranch(session.branchId, 'order.created', {
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
    });
    this.realtime.emitToBranch(session.branchId, 'order.paid', {
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
    });

    // Auto-print receipt on branch thermal printer (USB/LAN/COM)
    try {
      void this.ordersService.printThermalReceipt(session.branchId, createdOrder.orderNumber);
    } catch (err) {
      this.logger.warn('Auto thermal print on payment verify failed:', err);
    }

    return {
      status: 'PAID',
      orderNumber: createdOrder.orderNumber,
      confirmation,
    };
  }

  verifyWebhookSignature(bodyText: string, signature?: string): boolean {
    const config = this.getRawConfig();
    if (!config.webhookSecret) {
      return true; // Webhook secret not configured, pass-through
    }
    if (!signature) {
      return false;
    }
    try {
      return Razorpay.validateWebhookSignature(bodyText, signature, config.webhookSecret);
    } catch (err) {
      this.logger.warn('Failed to validate Razorpay webhook signature:', err);
      return false;
    }
  }

  private cleanExpiredSessions() {
    const now = Date.now();
    for (const [key, session] of this.pendingPayments.entries()) {
      if (now > session.expiresAt + 60_000) {
        this.pendingPayments.delete(key);
      }
    }
  }
}
