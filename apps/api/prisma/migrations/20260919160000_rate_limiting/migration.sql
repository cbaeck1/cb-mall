-- PRD.md 8.11절: 파일 업로드/다운로드 요청 속도 제한
-- 1) increment_download_count()를 개정하여 분당 3회 발급 제한 + download_logs 기록을 원자적으로 처리
-- 2) 로그인/비밀번호 재설정용 공유 속도 제한 저장소(rate_limit_buckets) 추가

-- ============================================================
-- 1) 다운로드 URL 발급 속도 제한 + 다운로드 이력 기록 (기존 함수 개정)
--    - 분당 3회 초과 발급 시 거부
--    - 통과 시 download_count 증가와 download_logs 기록을 한 트랜잭션에서 처리
-- ============================================================
CREATE OR REPLACE FUNCTION increment_download_count(
  p_entitlement_id UUID,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS entitlements
LANGUAGE plpgsql
AS $$
DECLARE
  v_row entitlements;
  v_recent_count INTEGER;
BEGIN
  SELECT count(*) INTO v_recent_count
  FROM download_logs
  WHERE entitlement_id = p_entitlement_id
    AND issued_at > now() - INTERVAL '1 minute';

  IF v_recent_count >= 3 THEN
    RAISE EXCEPTION 'DOWNLOAD_RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE entitlements
  SET download_count = download_count + 1
  WHERE id = p_entitlement_id
    AND download_count < max_downloads
    AND expires_at > now()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'DOWNLOAD_LIMIT_EXCEEDED_OR_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO download_logs (entitlement_id, ip_address, user_agent)
  VALUES (p_entitlement_id, p_ip_address, p_user_agent);

  RETURN v_row;
END;
$$;

-- ============================================================
-- 2) 로그인/비밀번호 재설정 등 보안 민감 엔드포인트의 공유 속도 제한 저장소 (8.7/8.11절)
--    NestJS ThrottlerStorage 커스텀 구현이 이 테이블에 대해 upsert + 만료 정리를 수행한다.
-- ============================================================
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "window_start" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets"("expires_at");
ALTER TABLE "rate_limit_buckets" ENABLE ROW LEVEL SECURITY;
