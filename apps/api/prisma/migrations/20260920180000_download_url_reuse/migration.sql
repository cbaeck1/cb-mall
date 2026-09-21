-- PRD.md 8.73절 V-2: 유효한 URL이 남아 있으면 재발급하되 횟수를 소모하지 않는다
--
-- 배경: 8.4절은 presigned URL 발급 시점에 카운트를 올린다. 그래서 다운로드가 시작되지 않는 것
--       같아 버튼을 세 번 누른 정상 사용자가 한도 3회를 잃는다. 8.11절의 분당 3회 제한은 이를
--       막아주기는커녕 분당 3회씩 소진되도록 허용하므로, 10회가 3~4분 만에 바닥날 수 있다.
--
-- 설계상 주의(구멍 방지): 재사용 창을 **슬라이딩**으로 잡으면 안 된다.
--   "마지막 발급이 5분 이내면 무료"로 하면, 5분마다 한 번씩 누르는 것만으로 **1회 차감으로
--   무기한 접근**이 가능해져 10회 한도가 무의미해진다.
--   따라서 **마지막으로 '차감된' 발급 시각**을 기준으로 하는 **고정 창**을 쓴다.
--   → download_logs에 counted 플래그를 두고, 차감된 발급만 창의 기준점이 된다.
--
-- 로그는 차감 여부와 무관하게 항상 남긴다. FR-4.5(최초 클릭 시각)와 FR-3.5(환불 판정)는
-- "사용자가 링크를 클릭했는가"를 보는 것이므로 재사용 발급도 이력에 포함되어야 한다.

ALTER TABLE "download_logs" ADD COLUMN "counted" BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN "download_logs"."counted" IS
  'true = 이 발급이 entitlements.download_count를 1 증가시켰음. false = 유효 창 안의 재사용 발급(8.73절 V-2).';

-- 속도 제한 조회(엔타이틀먼트 + 최근 1분)와 창 기준점 조회(엔타이틀먼트 + counted)를 함께 뒷받침
CREATE INDEX "download_logs_entitlement_issued_idx"
    ON "download_logs" ("entitlement_id", "issued_at" DESC);

-- 차감된 발급만 골라내는 조회(속도 제한 ①-a, 재사용 창 기준점)를 뒷받침
CREATE INDEX "download_logs_entitlement_counted_idx"
    ON "download_logs" ("entitlement_id", "issued_at" DESC) WHERE "counted" = true;

-- ============================================================
-- increment_download_count() 개정 (8.11절 → 8.73절)
--   ① 엔타이틀먼트 단위 속도 제한 — 차감 발급 분당 3회 / 전체 요청 분당 10회 (8.73절 V-3, 8.74절 W-1)
--   ② 마지막 '차감된' 발급이 유효기간(5분) 안이면 → 차감하지 않고 통과
--   ③ 그 외에는 기존대로 차감
--   ※ 유효기간은 8.4절 URL 수명(5분, 8.73절 V-1)과 반드시 같은 값이어야 한다.
--     애플리케이션 상수와 어긋나면 "URL은 만료됐는데 차감은 안 되는" 구간이 생긴다.
-- ============================================================
CREATE OR REPLACE FUNCTION increment_download_count(
  p_entitlement_id UUID,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_url_ttl_minutes INTEGER DEFAULT 5
)
RETURNS entitlements
LANGUAGE plpgsql
AS $$
DECLARE
  v_row           entitlements;
  v_recent_count   INTEGER;
  v_counted_recent INTEGER;
  v_last_counted   TIMESTAMP(3);
BEGIN
  -- ① 속도 제한: 두 개로 분리한다(8.74절 W-1)
  --    단일 제한으로 재사용 발급까지 함께 세면, V-2가 구하려던 "반복 클릭하는 정상 사용자"가
  --    한도는 안 깎여도 4번째 클릭에서 429를 맞는다 — 목적이 절반만 달성된다.
  --    ①-a 차감되는 발급: 분당 3회 (남용 방지의 본래 목적)
  --    ①-b 전체 요청(재사용 포함): 분당 10회 (자동화 스크립트만 걸리는 느슨한 상한)
  SELECT count(*) INTO v_recent_count
  FROM download_logs
  WHERE entitlement_id = p_entitlement_id
    AND issued_at > now() - INTERVAL '1 minute';

  IF v_recent_count >= 10 THEN
    RAISE EXCEPTION 'DOWNLOAD_RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_counted_recent
  FROM download_logs
  WHERE entitlement_id = p_entitlement_id
    AND counted = true
    AND issued_at > now() - INTERVAL '1 minute';

  IF v_counted_recent >= 3 THEN
    RAISE EXCEPTION 'DOWNLOAD_RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  -- ② 직전 '차감된' 발급이 아직 유효 창 안인가?
  SELECT max(issued_at) INTO v_last_counted
  FROM download_logs
  WHERE entitlement_id = p_entitlement_id
    AND counted = true;

  IF v_last_counted IS NOT NULL
     AND v_last_counted > now() - (p_url_ttl_minutes * INTERVAL '1 minute') THEN
    -- 재사용: 차감 없이 현재 상태만 돌려준다. 단 엔타이틀먼트 자체의 유효성은 확인한다.
    SELECT * INTO v_row FROM entitlements
    WHERE id = p_entitlement_id AND expires_at > now();

    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'DOWNLOAD_LIMIT_EXCEEDED_OR_EXPIRED' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO download_logs (entitlement_id, ip_address, user_agent, counted)
    VALUES (p_entitlement_id, p_ip_address, p_user_agent, false);

    RETURN v_row;
  END IF;

  -- ③ 통상 경로: 한도 확인 후 차감
  UPDATE entitlements
  SET download_count = download_count + 1
  WHERE id = p_entitlement_id
    AND download_count < max_downloads
    AND expires_at > now()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'DOWNLOAD_LIMIT_EXCEEDED_OR_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO download_logs (entitlement_id, ip_address, user_agent, counted)
  VALUES (p_entitlement_id, p_ip_address, p_user_agent, true);

  RETURN v_row;
END;
$$;
