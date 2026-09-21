import { Body, Controller, Get, Param, Patch, Post, Query, UseInterceptors } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import { checkoutSchema, orderStatusUpdateSchema, resolveNeedsReviewSchema, paginationQuerySchema } from "@cb-mall/shared-types";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { AuditAction, AuditLogInterceptor } from "../../common/interceptors/audit-log.interceptor";
import { OrdersService } from "./orders.service";

class CheckoutDto extends createZodDto(checkoutSchema) {}
class OrderStatusUpdateDto extends createZodDto(orderStatusUpdateSchema) {}
class ResolveNeedsReviewDto extends createZodDto(resolveNeedsReviewSchema) {}

// PRD FR-3.1~3.5, FR-7.3
@Controller()
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  // 회원/비회원 모두 결제 가능(FR-4.3) — 인증 없이도 접근 가능하되, 로그인 상태면 CurrentUser로 연결
  @Public()
  @Post("orders/checkout")
  checkout(@Body() dto: CheckoutDto, @CurrentUser() user: AuthenticatedUser | undefined) {
    return this.service.checkout(dto, { userId: user?.id });
  }

  @Get("mypage/orders")
  myOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findMyOrders(user.id);
  }

  @Roles("ADMIN", "SUPER_ADMIN")
  @Get("admin/orders")
  adminList(@Query() query: Record<string, unknown>) {
    const { page, pageSize } = paginationQuerySchema.parse(query);
    return this.service.findAdminList(page, pageSize);
  }

  @Roles("ADMIN", "SUPER_ADMIN")
  @Get("admin/orders/:id")
  adminDetail(@Param("id") id: string) {
    return this.service.findAdminDetail(id);
  }

  @Roles("ADMIN", "SUPER_ADMIN")
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction("order.status_change", "Order")
  @Patch("admin/orders/:id/status")
  async updateStatus(@Param("id") id: string, @Body() dto: OrderStatusUpdateDto) {
    await this.service.updateStatus(id, dto);
    return { ok: true };
  }

  // 8.71절 T-2: NEEDS_REVIEW 처리
  @Roles("SUPER_ADMIN")
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction("order.resolve_needs_review", "Order")
  @Patch("admin/orders/:id/resolve-review")
  async resolveNeedsReview(@Param("id") id: string, @Body() dto: ResolveNeedsReviewDto) {
    await this.service.resolveNeedsReview(id, dto);
    return { ok: true };
  }
}
