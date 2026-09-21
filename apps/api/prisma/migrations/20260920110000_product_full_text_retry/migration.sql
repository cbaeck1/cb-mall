-- PRD.md 8.32절: PDF 텍스트 추출 재시도/정체감지/실패율 모니터링을 위한 컬럼 추가

ALTER TABLE "product_full_texts" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "product_full_texts" ADD COLUMN "last_error" TEXT;
ALTER TABLE "product_full_texts" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "product_full_texts_status_idx" ON "product_full_texts"("status");
