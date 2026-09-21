import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { CouponsService } from "../coupons/coupons.service";
import { EntitlementsService } from "../entitlements/entitlements.service";
import { PaymentsService } from "../payments/payments.service";
import type { CheckoutInput, OrderStatusUpdateInput, ResolveNeedsReviewInput } from "@cb-mall/shared-types";

// PRD FR-3.1~3.5, 8.8/8.12/8.51절 C-1, 8.71절 T-2
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coupons: CouponsService,
    private readonly entitlements: EntitlementsService,
    private readonly payments: PaymentsService,
  ) {}

  async checkout(input: CheckoutInput, requester: { userId?: string }) {
    if (!requester.userId && !input.guestEmail) {
      throw new BadRequestException("GUEST_EMAIL_REQUIRED");
    }
    if (!requester.userId && input.couponCode) {
      throw new BadRequestException("COUPON_REQUIRES_LOGIN"); // CouponRedemption은 userId 필수
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: input.productIds }, status: "ON_SALE" },
    });
    if (products.length !== input.productIds.length) throw new BadRequestException("SOME_PRODUCTS_UNAVAILABLE");

    const subtotal = products.reduce((sum, p) => sum + (p.discountPrice ?? p.price), 0);
    let discountAmount = 0;
    let couponId: string | undefined;
    if (input.couponCode) {
      const result = await this.coupons.validate(input.couponCode, subtotal);
      discountAmount = result.discountAmount;
      couponId = result.couponId;
    }
    const totalAmount = subtotal - discountAmount;

    const cartHash = createHash("sha256")
      .update([...input.productIds].sort().join(","))
      .digest("hex");
    const tossOrderId = `order_${randomUUID()}`;

    try {
      const order = await this.prisma.order.create({
        data: {
          userId: requester.userId,
          guestEmail: requester.userId ? undefined : input.guestEmail,
          totalAmount,
          discountAmount,
          couponId,
          cartHash,
          tossOrderId,
          items: {
            create: products.map((p) => ({
              productId: p.id,
              productTitleSnapshot: p.title,
              priceAtPurchase: p.discountPrice ?? p.price,
            })),
          },
        },
        include: { items: true },
      });

      if (couponId && requester.userId) {
        await this.coupons.redeem(couponId, requester.userId, order.id);
      }
      return order;
    } catch (err) {
      // 8.51절 C-1: 동일 장바구니(user_id + cart_hash)의 PENDING 주문이 이미 있으면 그걸 재사용한다.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await this.prisma.order.findFirst({
          where: { userId: requester.userId, cartHash, status: "PENDING" },
          include: { items: true },
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  // 8.8/8.12절: 30분 이상 PENDING인 주문 자동 취소 — 5분마다
  async autoCancelStalePending(): Promise<number> {
    const res = await this.prisma.order.updateMany({
      where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) } },
      data: { status: "CANCELLED" },
    });
    return res.count;
  }

  findAdminList(page: number, pageSize: number) {
    return Promise.all([
      this.prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { items: true },
      }),
      this.prisma.order.count(),
    ]).then(([items, total]) => ({ items, total, page, pageSize }));
  }

  async findAdminDetail(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new NotFoundException("ORDER_NOT_FOUND");
    return order;
  }

  // FR-3.3: 관리자 수동 상태 변경(NEEDS_REVIEW 이외의 일반적인 경우)
  async updateStatus(id: string, input: OrderStatusUpdateInput): Promise<void> {
    await this.prisma.order.update({ where: { id }, data: { status: input.status } });
  }

  // FR-7.3/8.71절 T-2: 검토 대기 주문 처리 — 자동 판단하지 않고 관리자가 선택
  async resolveNeedsReview(id: string, input: ResolveNeedsReviewInput): Promise<void> {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
    if (order.status !== "NEEDS_REVIEW") throw new BadRequestException("ORDER_NOT_IN_REVIEW");

    if (input.resolution === "RESTORE") {
      await this.prisma.order.update({ where: { id }, data: { status: "PAID", paidAt: order.paidAt ?? new Date() } });
      await this.entitlements.createForOrder(id);
    } else {
      await this.payments.refund(id, input.note); // 실제 결제 취소까지 수행(토스 재조회로 이미 paymentKey 확보됨)
    }
  }

  async findMyOrders(userId: string) {
    return this.prisma.order.findMany({ where: { userId }, include: { items: true }, orderBy: { createdAt: "desc" } });
  }
}
