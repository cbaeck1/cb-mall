-- PRD.md 8.27절: pg_trgm 기반 오타 허용 유사도 검색 + 초성 검색

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- products: 초성 검색용 컬럼 (애플리케이션이 title 등록/수정 시 계산해 채움)
ALTER TABLE "products" ADD COLUMN "title_chosung" TEXT;

-- 트라이그램 GIN 인덱스 (Prisma 스키마 DSL로 표현하지 않고 raw SQL로 직접 관리)
CREATE INDEX "products_title_trgm_idx" ON "products" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "products_title_chosung_trgm_idx" ON "products" USING GIN ("title_chosung" gin_trgm_ops);
