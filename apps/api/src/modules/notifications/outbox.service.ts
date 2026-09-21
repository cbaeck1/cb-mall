import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { getMaxAttempts } from "./retry-profile";
import type { NotificationChannel } from "@cb-mall/shared-types";

export interface EnqueueInput {
  channel: NotificationChannel;
  recipientRef: string; // EMAIL=이메일 주소, SMS=휴대폰번호, PUSH=user_id
  template: string;
  payload: Record<string, unknown>; // 8.58절 G-5: 식별자 또는 부득이한 원문 토큰만. 발송 성공 후 정리됨.
  provider: string;
}

// PRD 8.17절: notification_outbox 통합. 8.58절 G-1/G-2: 행 INSERT 자체가 이 서비스 안에서
// 완결되는 단일 쓰기이므로(호출부의 더 큰 트랜잭션에 편입되지 않음), INSERT가 성공적으로 커밋된
// 직후 이 서비스가 스스로 즉시 발송 이벤트를 발행한다 — 호출부가 emit을 잊는 실수를 구조적으로 없앤다.
// 주의: 이 서비스를 다른 $transaction(tx => ...) 콜백 안에서 tx 클라이언트로 호출하지 말 것 —
// 항상 this.prisma(전역 클라이언트)로 단독 커밋되는 것을 전제로 "커밋 이후 발행"이 성립한다.
@Injectable()
export class OutboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async enqueue(input: EnqueueInput): Promise<string> {
    const row = await this.prisma.notificationOutbox.create({
      data: {
        channel: input.channel,
        recipientRef: input.recipientRef,
        template: input.template,
        payload: input.payload as never,
        provider: input.provider,
        maxAttempts: getMaxAttempts(input.template),
        nextRetryAt: new Date(), // 즉시 처리 대상
      },
    });
    this.events.emit("notification.created", row.id);
    return row.id;
  }

  // 8.75절 P1: 푸시는 항상 이메일과 쌍으로 발송한다(단독 전달 없음). fcmTokens가 비어 있으면 푸시 행은 생략.
  async enqueueEmailWithOptionalPush(params: {
    email: string;
    fcmTokens: string[];
    template: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.enqueue({
      channel: "EMAIL",
      recipientRef: params.email,
      template: params.template,
      payload: params.payload,
      provider: "resend",
    });
    for (const token of params.fcmTokens) {
      await this.enqueue({
        channel: "PUSH",
        recipientRef: token,
        template: params.template,
        payload: params.payload,
        provider: "fcm",
      });
    }
  }
}
