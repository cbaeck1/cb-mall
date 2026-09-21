-- PRD.md 8.5/8.6절: 원자적 증감을 위한 PL/pgSQL 함수 + Supabase RLS 방어적 이중화
-- NestJS에서는 Prisma `$queryRaw`로 `SELECT * FROM <함수명>($1, ...)` 형태로 호출한다.
-- 이 마이그레이션은 prisma/schema.prisma의 모델 변경 없이 순수 SQL만 추가하므로,
-- 실제 적용 시 `npx prisma migrate dev --create-only`로 빈 마이그레이션을 만든 뒤 이 내용을 채워 넣는다.

-- ============================================================
-- 1) 다운로드 횟수 원자적 증가 (FR-4.2: 구매일+1년, 최대 10회)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_download_count(p_entitlement_id UUID)
RETURNS entitlements
LANGUAGE plpgsql
AS $$
DECLARE
  v_row entitlements;
BEGIN
  UPDATE entitlements
  SET download_count = download_count + 1
  WHERE id = p_entitlement_id
    AND download_count < max_downloads
    AND expires_at > now()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'DOWNLOAD_LIMIT_EXCEEDED_OR_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_row;
END;
$$;

-- ============================================================
-- 2) 쿠폰 사용 원자적 증가 (FR-6.1: 사용한도/유효기간 검증)
-- ============================================================
CREATE OR REPLACE FUNCTION redeem_coupon(p_coupon_id UUID)
RETURNS coupons
LANGUAGE plpgsql
AS $$
DECLARE
  v_row coupons;
BEGIN
  UPDATE coupons
  SET used_count = used_count + 1
  WHERE id = p_coupon_id
    AND (usage_limit IS NULL OR used_count < usage_limit)
    AND now() BETWEEN valid_from AND valid_to
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'COUPON_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_row;
END;
$$;

-- ============================================================
-- 3) 포인트 잔액 원자적 증감 (FR-6.2: 적립은 양수, 사용은 음수 delta로 호출, 음수 잔액 방지)
-- ============================================================
CREATE OR REPLACE FUNCTION adjust_point_balance(p_user_id UUID, p_delta INTEGER)
RETURNS users
LANGUAGE plpgsql
AS $$
DECLARE
  v_row users;
BEGIN
  UPDATE users
  SET point_balance = point_balance + p_delta
  WHERE id = p_user_id
    AND point_balance + p_delta >= 0
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_POINT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_row;
END;
$$;

-- ============================================================
-- 4) Supabase RLS 방어적 이중화 (8.5절)
--    - 명시적 허용 정책 없음 = anon/authenticated 롤은 기본적으로 모든 접근 거부
--    - NestJS/Prisma가 DATABASE_URL로 연결할 때 쓰는 DB 롤(postgres 등)은 BYPASSRLS 속성으로
--      RLS 자체를 우회하므로 백엔드 기능에는 영향이 없음
-- ============================================================
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "download_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coupon_redemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inquiries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_qnas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "point_transactions" ENABLE ROW LEVEL SECURITY;
