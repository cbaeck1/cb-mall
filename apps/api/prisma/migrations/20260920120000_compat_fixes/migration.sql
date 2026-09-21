-- PRD.md 8.51절 상호 호환성 감사 결과 반영
--
-- C-1: 주문 생성 중복 클릭 방지를 "5초 세션 단위 Advisory Lock"에서
--      "PENDING 주문에 대한 부분 유니크 인덱스"로 변경.
--      (세션 단위 락은 8.15절 Supavisor 트랜잭션 모드 풀러와 호환되지 않고,
--       트랜잭션 단위 락으로 바꾸면 보호 시간창이 트랜잭션 길이로 줄어드는 문제가 있음)
--      Cron 작업(8.12절)은 pg_try_advisory_xact_lock(트랜잭션 단위)로 전환 — 애플리케이션 코드에서 처리.

ALTER TABLE "orders" ADD COLUMN "cart_hash" TEXT;

-- 같은 사용자가 같은 장바구니 구성으로 PENDING 주문을 중복 생성하지 못하도록 방지.
-- 결제 완료(PAID)/취소(CANCELLED) 이후에는 제약이 풀려 재구매가 정상 동작한다.
CREATE UNIQUE INDEX "orders_user_id_cart_hash_pending_key"
    ON "orders" ("user_id", "cart_hash")
    WHERE "status" = 'PENDING' AND "user_id" IS NOT NULL AND "cart_hash" IS NOT NULL;
