import { Body, Controller, HttpCode, Param, Post, UseInterceptors } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import { confirmPaymentSchema } from "@cb-mall/shared-types";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuditAction, AuditLogInterceptor } from "../../common/interceptors/audit-log.interceptor";
import { PaymentsService } from "./payments.service";

class ConfirmPaymentDto extends createZodDto(confirmPaymentSchema) {}

interface TossWebhookBody {
  eventType: string;
  data: { paymentKey: string; orderId: string; status: string; totalAmount: number };
}

// PRD 8.8/8.9/8.71절
@Controller()
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  // 8.8절: Idempotency-Key는 orderId에서 결정적으로 생성 — 같은 주문의 재시도 confirm 호출이
  // 토스 쪽에서도 안전하게 중복 제거된다.
  @Public()
  @Post("payments/confirm")
  @HttpCode(200)
  confirm(@Body() dto: ConfirmPaymentDto) {
    return this.service.confirm(dto, `order-confirm:${dto.orderId}`);
  }

  // 8.71절: 서명이 없으므로 재조회로 검증. 실패 시 5xx를 반환해 토스 재시도를 유도한다(T-1).
  @Public()
  @Post("payments/webhook")
  @HttpCode(200)
  async webhook(@Body() body: TossWebhookBody) {
    await this.service.handleWebhook(body.eventType, body.data);
    return { ok: true };
  }

  @Roles("ADMIN", "SUPER_ADMIN")
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction("order.refund", "Order")
  @Post("admin/orders/:id/refund")
  async refund(@Param("id") id: string, @Body("reason") reason: string) {
    await this.service.refund(id, reason);
    return { ok: true };
  }
}
