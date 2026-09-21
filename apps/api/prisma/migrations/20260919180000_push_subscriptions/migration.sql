-- PRD.md 8.16절: 웹 푸시 알림(FCM) 등록 토큰 저장. 실제 알림 트리거는 추후 FR 확정 후 별도 구현.

CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "fcm_token" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_subscriptions_fcm_token_key" ON "push_subscriptions"("fcm_token");
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8.6절 정책에 따라 RLS 방어적 이중화 적용
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
