-- PRD.md 8.68절: RLS 통과 정책 + 이미 존재하는 객체에 대한 권한 정리
--
-- 배경(8.68절 Q-1): 8.6절의 "RLS 방어적 이중화"는 애플리케이션 경로를 지켜주지 않는다.
--   RLS가 실제로 막는 것은 Supabase가 자동 노출하는 PostgREST Data API다 —
--   anon 키는 설계상 공개되는 값이고, 우리는 Supabase Auth를 쓰지 않으므로(자체 인증, 8.7절)
--   "RLS 활성 + anon 정책 0개 = 전면 거부"가 정확히 의도한 상태다.
--
-- ⚠ anon / authenticated 를 대상으로 하는 정책을 추가하지 말 것.
--   정책이 0개인 것이 의도다. 하나라도 추가하면 공개 키로 읽히는 테이블이 생긴다.

-- 1) cbmall_app 전용 RLS 통과 정책 (8.68절 Q-3 방안 A)
--
-- cbmall_app은 BYPASSRLS를 갖지 않으므로(setup/roles.sql 참고) 명시적 허용 정책이 필요하다.
-- 행 단위 권한 검사는 애플리케이션이 담당하므로(8.6절) 여기서는 롤 전체를 통과시킨다.
-- 정책 대상이 `TO cbmall_app` 하나뿐이라 anon·authenticated는 계속 전면 거부된다.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = c.relname AND p.policyname = 'app_all'
      )
  LOOP
    EXECUTE format(
      'CREATE POLICY app_all ON public.%I FOR ALL TO cbmall_app USING (true) WITH CHECK (true)', t
    );
  END LOOP;
END $$;

-- 2) 이미 존재하는 객체에 대한 권한 부여/회수
--
-- setup/roles.sql은 최초 마이그레이션보다 먼저 실행되므로 ALTER DEFAULT PRIVILEGES만 설정한다.
-- 여기서는 그 시점 이후 실제로 만들어진 객체들을 한 번 정리한다(8.68절 Q-4).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cbmall_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cbmall_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO cbmall_app;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- ※ 앞으로 테이블을 추가하는 마이그레이션은 세 가지를 함께 넣어야 한다(8.68절 Q-5, CI가 검사):
--     ① ALTER TABLE "<t>" ENABLE ROW LEVEL SECURITY;
--     ② CREATE POLICY app_all ON "<t>" FOR ALL TO cbmall_app USING (true) WITH CHECK (true);
--     ③ (권한은 setup/roles.sql의 ALTER DEFAULT PRIVILEGES가 자동 처리하므로 불필요)
