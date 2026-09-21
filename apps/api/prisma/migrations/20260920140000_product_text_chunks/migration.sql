-- PRD.md 8.59절 H-1: 본문검색 대상을 "책 1권 = 1행"에서 "청크 단위 다중 행"으로 전환.
--
-- 배경: pg_trgm GIN은 후보 행만 돌려주고 Postgres가 실제 ILIKE를 재검사(recheck)한다.
--       전자책 1권(30만~60만 자, UTF-8 약 1~1.8MB)이 1행인 구조에서는 "데이터"·"있습니" 같은
--       흔한 트라이그램이 거의 모든 책에 존재하므로 후보 = 전체 행이 되고, 결국 모든 행의
--       extracted_text를 TOAST에서 꺼내 압축 해제한 뒤 재검사하게 되어 순차 스캔보다 느려진다.
--
-- 전환 후: 청크(목표 1,000자, 8.60절 I-7)당 1행이라 ① 재검사·TOAST 비용이 사라지고 ② 트라이그램 선택도가
--          회복되며 ③ 스니펫을 청크 내 오프셋으로 생성하고 ④ 검색 결과에 "N쪽"을 표시할 수 있다.
--          규모는 200권 × 약 300청크 = 6만 행 수준.
--
-- product_full_texts는 삭제하지 않는다 — 추출 상태(PENDING/DONE/FAILED)·재시도·클레임 관리용으로 유지(8.32/8.52절).

CREATE TABLE "product_text_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "page_from" INTEGER,
    "page_to" INTEGER,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_text_chunks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "product_text_chunks" ADD CONSTRAINT "product_text_chunks_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 재추출 시 중복 삽입을 막는 유니크 제약.
-- 주의(8.60절 I-4): 재추출은 upsert가 아니라 product_id 기준 전량 DELETE 후 재삽입이어야 한다.
--   새 청크 수가 이전보다 적으면 chunk_index가 큰 옛 청크가 남아 "삭제된 본문"이 계속 검색되기 때문.
CREATE UNIQUE INDEX "product_text_chunks_product_id_chunk_index_key"
    ON "product_text_chunks" ("product_id", "chunk_index");

-- 상품 삭제/재추출 시 해당 상품의 청크만 골라내기 위한 인덱스
CREATE INDEX "product_text_chunks_product_id_idx" ON "product_text_chunks" ("product_id");

-- 본문검색 인덱스 (8.59절 H-1/H-2/H-5)
--
--   · 연산자: `ILIKE '%검색어%'` 부분문자열 매칭 (similarity()/% 아님 — 8.54절)
--   · 최소 길이: **검색어 3자 이상에만 이 인덱스를 사용하는 쿼리를 발행한다**.
--     와일드카드 사이 글자가 3자 미만이면 추출 가능한 트라이그램이 없어 full index scan으로
--     퇴화하므로(8.59절 H-2), 2자 이하 검색어는 애플리케이션이 본문검색 쿼리 자체를 발행하지 않고
--     제목·설명·초성 검색(8.27절)만 수행한다.
--   · fastupdate=off: GIN 기본값(on)은 INSERT를 pending list에 모았다가 나중에 반영하는데,
--     그 정리 작업을 검색 쿼리가 떠안으면 특정 요청만 갑자기 느려진다. cb몰은 쓰기(상품 등록)가
--     드물고 읽기(검색)가 중요하므로 off가 맞다(8.59절 H-5).
CREATE INDEX "product_text_chunks_content_trgm_idx"
    ON "product_text_chunks" USING GIN ("content" gin_trgm_ops)
    WITH (fastupdate = off);

-- 8.6절 정책에 따라 RLS 방어적 이중화 적용
ALTER TABLE "product_text_chunks" ENABLE ROW LEVEL SECURITY;

-- 검색이 청크 테이블로 옮겨갔으므로, product_full_texts의 본문 GIN 인덱스는 더 이상 쓰이지 않는다.
-- 본문 전체를 색인하는 가장 큰 인덱스이므로 방치하면 Supabase DB 용량만 잠식한다(8.59절 H-5).
-- 단, extracted_text 컬럼 자체는 남긴다 — PDF를 다시 내려받아 파싱하지 않고도 청크 재분할이 가능해야 하기 때문.
DROP INDEX IF EXISTS "product_full_texts_extracted_text_trgm_idx";

-- 8.60절 I-7: TOAST 외부 저장 회피
--
-- Postgres는 행이 TOAST_TUPLE_THRESHOLD(기본 2,032바이트)를 넘으면 큰 컬럼을 압축하고,
-- 그래도 넘으면 별도 TOAST 테이블로 옮긴다. 한글은 UTF-8 3바이트라 1,000자만 해도 3,000바이트다.
-- 기본 전략(EXTENDED)이면 외부 저장이 일어나 재검사(recheck)마다 TOAST 테이블 조회가 따라붙는데,
-- 이는 8.59절 H-1에서 청크 분할로 없애려던 바로 그 비용이다.
--
-- MAIN은 압축은 하되 외부 저장을 "행이 페이지에 도저히 안 들어갈 때"의 최후 수단으로만 쓰므로,
-- 압축된 본문이 힙 튜플에 함께 남아 재검사가 추가 I/O 없이 끝난다.
ALTER TABLE "product_text_chunks" ALTER COLUMN "content" SET STORAGE MAIN;
