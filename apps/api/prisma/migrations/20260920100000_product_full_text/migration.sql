-- PRD.md 8.31절: 원본 PDF 본문 전문검색(FR-2.7)을 위한 추출 텍스트 저장 및 트라이그램 인덱스
-- 주의: extracted_text는 검색(스니펫 생성) 전용 컬럼이며, 애플리케이션은 이 값을 API 응답으로
-- 그대로 반환해서는 안 된다(전체 본문 노출 금지 원칙, 8.31절).

CREATE TYPE "text_extraction_status" AS ENUM ('PENDING', 'DONE', 'FAILED');

CREATE TABLE "product_full_texts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "extracted_text" TEXT,
    "status" "text_extraction_status" NOT NULL DEFAULT 'PENDING',
    "extracted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_full_texts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_full_texts_product_id_key" ON "product_full_texts"("product_id");
ALTER TABLE "product_full_texts" ADD CONSTRAINT "product_full_texts_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 본문 검색 인덱스 (PRD 8.31 / 8.51 C-3 / 8.54절 재검증 결과)
--
-- 사용법이 중요하다: 이 GIN 인덱스는 `similarity()` / `%` 연산자가 아니라
-- **`ILIKE '%검색어%'` 부분문자열 검색을 가속**하는 용도로 사용한다.
--   - similarity()는 "문자열 전체의 트라이그램 비율"이라 수십만 자 본문에서는 값이 0에 수렴해 쓸 수 없음
--   - 반면 부분문자열 매칭은 한국어 조사가 붙어도("해리포터를") 원형("해리포터")을 포함하므로 오히려 적합
--     (tsvector + 'simple' 설정은 공백 단위 토큰화라 조사가 붙은 한국어를 매칭하지 못한다)
--   - 검색 결과 스니펫은 ts_headline이 아니라 애플리케이션에서 매칭 위치 ±15~20자를 잘라 생성한다
CREATE INDEX "product_full_texts_extracted_text_trgm_idx"
    ON "product_full_texts" USING GIN ("extracted_text" gin_trgm_ops);

-- 8.6절 정책에 따라 RLS 방어적 이중화 적용
ALTER TABLE "product_full_texts" ENABLE ROW LEVEL SECURITY;
