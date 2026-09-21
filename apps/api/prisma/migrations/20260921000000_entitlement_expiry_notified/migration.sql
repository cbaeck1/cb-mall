-- PRD.md 8.75절 / FR-4.6: 다운로드 만료 30일 전 알림 중복 발송 방지 플래그
ALTER TABLE "entitlements" ADD COLUMN "expiry_notified_at" TIMESTAMP(3);
