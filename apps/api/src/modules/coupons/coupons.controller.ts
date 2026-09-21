import { Body, Controller, Get, Post, UseInterceptors } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import { couponCreateSchema, couponValidateSchema } from "@cb-mall/shared-types";
import { Roles } from "../../common/decorators/roles.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { PostgresRateLimitGuard } from "../../common/rate-limit/rate-limit.guard";
import { UseGuards } from "@nestjs/common";
import { AuditAction, AuditLogInterceptor } from "../../common/interceptors/audit-log.interceptor";
import { CouponsService } from "./coupons.service";
import { PrismaService } from "../../prisma/prisma.service";

class CouponCreateDto extends createZodDto(couponCreateSchema) {}
class CouponValidateDto extends createZodDto(couponValidateSchema) {}

@Controller("coupons")
export class CouponsController {
  constructor(
    private readonly service: CouponsService,
    private readonly prisma: PrismaService,
  ) {}

  @Roles("ADMIN", "SUPER_ADMIN")
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction("coupon.create", "Coupon")
  @Post()
  create(@Body() dto: CouponCreateDto) {
    return this.service.create(dto);
  }

  @Roles("ADMIN", "SUPER_ADMIN")
  @Get()
  list() {
    return this.service.list();
  }

  // FR-6.1: 코드 무차별 대입 방어 — 분당 10회(8.25절)
  @UseGuards(PostgresRateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 60, keyBy: "ip" })
  @Post("validate")
  async validatePreview(@Body() dto: CouponValidateDto) {
    const products = await this.prisma.product.findMany({ where: { id: { in: dto.productIds } } });
    const orderAmount = products.reduce((sum, p) => sum + p.price, 0);
    return this.service.validate(dto.code, orderAmount);
  }
}
