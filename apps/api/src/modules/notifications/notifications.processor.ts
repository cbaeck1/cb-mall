import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import { S3Client } from "@aws-sdk/client-s3";
import { PrismaService } from "../../prisma/prisma.service";
import { computeNextRetryAt } from "./retry-profile";
import { renderTemplate } from "./templates";
import { EmailSender } from "./senders/email.sender";
import { SmsSender } from "./senders/sms.sender";
import { PushSender } from "./senders/push.sender";

// 8.52절 B형(외부 I/O 포함 작업) 행 클레이밍의 원시 컬럼명(snake_case) — $queryRaw는 Prisma의
// camelCase 매핑을 거치지 않으므로 DB 컬럼명 그대로 받는다.
interface OutboxRawRow {
  id: string;
  channel: "EMAIL" | "SMS" | "PUSH";
  recipient_ref: string;
  template: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
  created_at: Date;
}

@Injectable()
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private readonly s3: S3Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailSender: EmailSender,
    private readonly smsSender: SmsSender,
    private readonly pushSender: PushSender,
  ) {
    this.s3 = new S3Client({ region: this.config.get("AWS_REGION") });
  }

  // 8.58절 G-1: 이벤트 기반 즉시 발송도 반드시 이 클레임 절차를 거친다(별도 경로 없음).
  @OnEvent("notification.created")
  async handleImmediate(outboxId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<OutboxRawRow[]>`
      UPDATE notification_outbox
      SET claimed_at = now()
      WHERE id IN (
        SELECT id FROM notification_outbox
        WHERE id = ${outboxId}::uuid AND status = 'PENDING'
          AND (claimed_at IS NULL OR claimed_at < now() - interval '1 minute')
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, channel, recipient_ref, template, payload, status, attempts, max_attempts, created_at;
    `;
    for (const row of rows) await this.processRow(row);
  }

  // 8.12/8.18절: 1분마다 재시도 대상을 클레임해 처리
  async pollAndProcessBatch(limit = 50): Promise<number> {
    const rows = await this.prisma.$queryRaw<OutboxRawRow[]>`
      UPDATE notification_outbox
      SET claimed_at = now()
      WHERE id IN (
        SELECT id FROM notification_outbox
        WHERE status = 'PENDING' AND next_retry_at <= now()
          AND (claimed_at IS NULL OR claimed_at < now() - interval '1 minute')
        ORDER BY next_retry_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, channel, recipient_ref, template, payload, status, attempts, max_attempts, created_at;
    `;
    for (const row of rows) await this.processRow(row);
    return rows.length;
  }

  // FR-7.7: 관리자 수동 재발송. 대상은 FAILED만(8.74절 W-3: CANCELLED는 정상 종료라 제외).
  async retryFailed(outboxId: string): Promise<void> {
    await this.prisma.notificationOutbox.updateMany({
      where: { id: outboxId, status: "FAILED" },
      data: { status: "PENDING", nextRetryAt: new Date(), claimedAt: null },
    });
    await this.handleImmediate(outboxId);
  }

  private async processRow(row: OutboxRawRow): Promise<void> {
    try {
      const result = await renderTemplate(
        {
          prisma: this.prisma,
          frontendOrigin: this.config.get<string>("FRONTEND_ORIGIN")!,
          s3: this.s3,
          privateBucket: this.config.get<string>("S3_PRIVATE_BUCKET")!,
        },
        row.template,
        row.payload,
      );

      if (result.skip) {
        // 8.72절 U-2: 만료된 토큰 등 — 재시도 없이 즉시 실패 처리(불필요한 발송 시도 자체를 없앰)
        await this.prisma.notificationOutbox.update({
          where: { id: row.id },
          data: { status: "FAILED", lastError: result.skipReason, claimedAt: null },
        });
        return;
      }

      if (row.channel === "EMAIL" && result.email) {
        await this.emailSender.send({ to: row.recipient_ref, subject: result.email.subject, html: result.email.html });
      } else if (row.channel === "SMS" && result.sms) {
        await this.smsSender.send({ to: row.recipient_ref, text: result.sms.text });
      } else if (row.channel === "PUSH" && result.push) {
        await this.pushSender.send({ fcmToken: row.recipient_ref, title: result.push.title, body: result.push.body });
      } else {
        throw new Error(`NO_RENDERER_FOR_CHANNEL_${row.channel}`);
      }

      await this.prisma.notificationOutbox.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date(), claimedAt: null },
      });
    } catch (err) {
      const attempts = row.attempts + 1;
      const nextRetryAt = computeNextRetryAt(row.template, row.created_at, attempts);
      await this.prisma.notificationOutbox.update({
        where: { id: row.id },
        data: {
          attempts,
          status: nextRetryAt ? "PENDING" : "FAILED",
          nextRetryAt: nextRetryAt ?? undefined,
          lastError: err instanceof Error ? err.message : String(err),
          claimedAt: null,
        },
      });
      this.logger.warn(`알림 발송 실패 id=${row.id} template=${row.template} attempts=${attempts}`);
    }
  }
}
