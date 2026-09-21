-- PRD.md 8.8~8.9절: 결제 상태 웹훅(PAYMENT_STATUS_CHANGED) 중복 수신 방지 및 재조회 검증 기록

CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "toss_event_id" TEXT,
    "payment_key" TEXT NOT NULL,
    "reported_status" TEXT NOT NULL,
    "verified_status" TEXT,
    "processed_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_webhook_events_toss_event_id_key" ON "payment_webhook_events"("toss_event_id");
CREATE INDEX "payment_webhook_events_payment_key_idx" ON "payment_webhook_events"("payment_key");

-- 8.6절 정책에 따라 RLS 방어적 이중화 적용
ALTER TABLE "payment_webhook_events" ENABLE ROW LEVEL SECURITY;
