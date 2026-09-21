import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsProcessor } from "./notifications.processor";
import { OutboxService } from "./outbox.service";

@Injectable()
export class NotificationsCron {
  private readonly logger = new Logger(NotificationsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: NotificationsProcessor,
    private readonly outbox: OutboxService,
  ) {}

  // 8.12/8.18절: 알림 재시도 — 1분마다
  @Cron("*/1 * * * *")
  async retryPending(): Promise<void> {
    const n = await this.processor.pollAndProcessBatch(50);
    if (n > 0) this.logger.log(`알림 배치 처리 ${n}건`);
  }

  // 8.12/8.58절 G-5: 발송 완료된 payload 정리 — 매일 1회. 민감값(토큰)이 남은 SENT 행을 비운다.
  @Cron("0 3 * * *")
  async cleanupSentPayloads(): Promise<void> {
    const res = await this.prisma.notificationOutbox.updateMany({
      where: { status: "SENT", payload: { not: {} } },
      data: { payload: {} },
    });
    if (res.count > 0) this.logger.log(`발송 완료 payload 정리 ${res.count}건`);
  }

  // FR-4.6 / 8.75절: 다운로드 만료 30일 전 대상 조회. 09~21시에만(발송 시점을 우리가 고르는 알림이므로 야간 회피).
  @Cron("0 9-21 * * *")
  async notifyExpiringEntitlements(): Promise<void> {
    const target = new Date();
    target.setDate(target.getDate() + 30);
    const dayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const entitlements = await this.prisma.entitlement.findMany({
      where: { expiresAt: { gte: dayStart, lt: dayEnd }, expiryNotifiedAt: null, userId: { not: null } },
      include: { user: { include: { pushSubscriptions: true } } },
    });

    for (const e of entitlements) {
      if (!e.user) continue;
      await this.outbox.enqueueEmailWithOptionalPush({
        email: e.user.email,
        fcmTokens: e.user.pushSubscriptions.map((p) => p.fcmToken),
        template: "entitlement_expiring",
        payload: { entitlementId: e.id },
      });
      await this.prisma.entitlement.update({ where: { id: e.id }, data: { expiryNotifiedAt: new Date() } });
    }
    if (entitlements.length > 0) this.logger.log(`다운로드 만료 임박 알림 ${entitlements.length}건`);
  }
}
