import { Body, Controller, Get, Post, Query, UseInterceptors } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import { resendNotificationSchema, paginationQuerySchema } from "@cb-mall/shared-types";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuditAction, AuditLogInterceptor } from "../../common/interceptors/audit-log.interceptor";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsProcessor } from "../notifications/notifications.processor";

class ResendNotificationDto extends createZodDto(resendNotificationSchema) {}

// FR-7.7: 알림 발송 이력 조회 및 수동 재발송. 대상은 FAILED만(8.74절 W-3: CANCELLED는 정상 종료라 제외).
@Roles("ADMIN", "SUPER_ADMIN")
@Controller("admin/notifications")
export class AdminNotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: NotificationsProcessor,
  ) {}

  @Get()
  async list(@Query() query: Record<string, unknown>) {
    const { page, pageSize } = paginationQuerySchema.parse(query);
    const [items, total] = await Promise.all([
      this.prisma.notificationOutbox.findMany({
        where: { status: { not: "CANCELLED" } }, // 8.74절 W-3
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notificationOutbox.count({ where: { status: { not: "CANCELLED" } } }),
    ]);
    return { items, total, page, pageSize };
  }

  @UseInterceptors(AuditLogInterceptor)
  @AuditAction("notification.resend", "NotificationOutbox")
  @Post("resend")
  async resend(@Body() dto: ResendNotificationDto) {
    await this.processor.retryFailed(dto.outboxId);
    return { ok: true };
  }
}
