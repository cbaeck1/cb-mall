-- PRD.md 8.52절: 외부 I/O를 포함하는 Cron 작업(알림 재시도 8.18, PDF 추출 재시도 8.32)을
-- Advisory Lock 기반 상호배제에서 `FOR UPDATE SKIP LOCKED` 행 클레이밍으로 전환.
--
-- 배경: 트랜잭션 단위 Advisory Lock은 "작업 본문 전체가 같은 트랜잭션 안에서 끝날 때"만
--       상호배제가 성립한다. 외부 API(Resend/솔라피/FCM)·S3 호출을 포함하는 작업을 그렇게 감싸면
--       네트워크 I/O 내내 DB 트랜잭션을 점유하게 되어 또 다른 안티패턴이 된다.
--
-- 처리 흐름:
--   ① 짧은 트랜잭션에서 대상 행을 FOR UPDATE SKIP LOCKED로 선점(claimed_at 기록) 후 커밋
--   ② 트랜잭션 밖에서 외부 호출 수행
--   ③ 결과를 별도의 짧은 트랜잭션으로 기록
--   ※ 처리 중 태스크가 죽으면 claimed_at이 일정 시간 지난 행을 다른 태스크가 다시 선점해 복구한다.
--     재선점 대기(8.58절 G-4): notification_outbox = 1분(8.18절 긴급 프로파일 1·3·10분과 정렬),
--     product_full_texts = 10분(추출 자체가 수 분 걸릴 수 있어 정상 처리 중인 행을 뺏지 않도록 길게).

ALTER TABLE "notification_outbox" ADD COLUMN "claimed_at" TIMESTAMP(3);
ALTER TABLE "product_full_texts" ADD COLUMN "claimed_at" TIMESTAMP(3);

-- 선점 대상 조회(status/next_retry_at/claimed_at 조건)를 뒷받침하는 인덱스
CREATE INDEX "notification_outbox_claim_idx"
    ON "notification_outbox" ("status", "next_retry_at", "claimed_at");

CREATE INDEX "product_full_texts_claim_idx"
    ON "product_full_texts" ("status", "claimed_at");
