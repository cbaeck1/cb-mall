-- PRD.md 8.13/8.14/8.16/8.17절: 이메일·SMS·웹푸시 발송 이력을 하나의 notification_outbox로 통합
-- 채널별 재시도 정책은 max_attempts로 구분(이메일=5, SMS/푸시=1 → 사실상 1회 발송)

CREATE TYPE "notification_channel" AS ENUM ('EMAIL', 'SMS', 'PUSH');
CREATE TYPE "notification_status" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "notification_outbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel" "notification_channel" NOT NULL,
    "recipient_ref" TEXT NOT NULL, -- EMAIL: 이메일 주소 / SMS: 휴대폰번호 / PUSH: user_id
    "template" TEXT NOT NULL, -- 예: "password_reset", "order_confirmation", "download_link"
    "payload" JSONB NOT NULL,
    "provider" TEXT NOT NULL, -- 예: "resend", "solapi", "fcm"
    "status" "notification_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 1, -- 이메일=5, SMS/푸시=1(재시도 없음, 8.14/8.16 정책)
    "next_retry_at" TIMESTAMP(3), -- 8.18절: 긴급/일반 프로파일별 지수 백오프 시점(이전에는 재시도하지 않음)
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notification_outbox_status_idx" ON "notification_outbox"("status");
CREATE INDEX "notification_outbox_channel_idx" ON "notification_outbox"("channel");
CREATE INDEX "notification_outbox_next_retry_at_idx" ON "notification_outbox"("next_retry_at");

-- 8.6절 정책에 따라 RLS 방어적 이중화 적용
ALTER TABLE "notification_outbox" ENABLE ROW LEVEL SECURITY;
