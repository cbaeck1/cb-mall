import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { CouponCreateInput } from "@cb-mall/shared-types";

// PRD FR-6.1, 8.5/8.6절: 쿠폰 사용 조건 검증 + 원자적 사용 카운트 증가(redeem_coupon PL/pgSQL 함수)
@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CouponCreateInput) {
    return this.prisma.coupon.create({ data: input });
  }

  list() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  }

  // 결제 전 미리보기 — 실제 사용 카운트 증가는 하지 않는다(주문 확정 시 redeem 호출).
  async validate(code: string, orderAmount: number): Promise<{ couponId: string; discountAmount: number }> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon) throw new NotFoundException("COUPON_NOT_FOUND");
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validTo) throw new BadRequestException("COUPON_EXPIRED");
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException("COUPON_USAGE_LIMIT_REACHED");
    }
    if (orderAmount < coupon.minOrderAmount) throw new BadRequestException("ORDER_AMOUNT_BELOW_MINIMUM");

    const discountAmount =
      coupon.type === "FIXED" ? coupon.value : Math.floor((orderAmount * coupon.value) / 100);
    return { couponId: coupon.id, discountAmount: Math.min(discountAmount, orderAmount) };
  }

  // 8.6절: PL/pgSQL 함수로 원자적 증감 — 동시 사용 시 usage_limit을 초과하지 않는다.
  async redeem(couponId: string, userId: string, orderId: string): Promise<void> {
    await this.prisma.$queryRaw`SELECT * FROM redeem_coupon(${couponId}::uuid);`;
    await this.prisma.couponRedemption.create({ data: { couponId, userId, orderId } });
  }
}
