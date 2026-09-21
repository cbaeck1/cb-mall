-- PRD.md 8.15/8.68절: 런타임 전용 최소권한 DB 롤 설정
--
-- ⚠ 실행 시점: **최초 마이그레이션(`prisma migrate deploy`)보다 먼저, 한 번만** 실행한다.
--    여기서는 롤 생성과 "앞으로 만들어질 객체"에 대한 기본 권한(ALTER DEFAULT PRIVILEGES)만
--    설정한다. 이미 존재하는 테이블을 대상으로 하는 작업(권한 부여/회수, RLS 정책)은
--    마이그레이션 `20260920150000_rls_app_policies`가 담당한다 — 이 파일을 마이그레이션보다
--    먼저 실행해야 하는데 그 시점에는 테이블이 아직 없기 때문이다(8.68절 정리 과정에서 발견).
--
-- 이 파일은 Prisma 마이그레이션 히스토리에 포함하지 않는다. 롤(ROLE)은 클러스터 단위 객체라
-- 마이그레이션으로 버전 관리하기에 적합하지 않다.
--
-- 마이그레이션(prisma migrate deploy)은 Supabase가 기본 제공하는 postgres 롤의
-- 다이렉트 커넥션(5432)을 그대로 사용하므로 별도 마이그레이션용 롤은 만들지 않는다.
--
-- 적용 범위(PRD 8.15/8.56절): **스테이징·운영 Supabase 프로젝트 2곳 모두**에서 실행한다.
-- PR 프리뷰는 별도 DB를 만들지 않고 스테이징 DB를 공유하므로(8.56절: Supabase 브랜칭 미사용),
-- 프리뷰 단계부터 운영과 동일한 최소권한 롤로 검증된다.

-- 1) 런타임 애플리케이션 전용 롤 생성 (비밀번호는 실제 적용 시 강력한 값으로 교체)
--
-- BYPASSRLS를 쓰지 않는다(PRD 8.68절 Q-3). 두 가지 이유:
--   ① PostgreSQL은 BYPASSRLS 부여를 superuser 또는 BYPASSRLS 보유자에게만 허용하는데,
--      Supabase의 postgres 롤은 superuser가 아니라 이 문장 자체가 실패할 수 있다.
--   ② 대신 쓰는 전용 허용 정책 방식이 "누가 통과하는지"를 스키마에 명시적으로 남겨 더 낫다.
--      (정책은 마이그레이션 20260920150000_rls_app_policies에서 생성)
CREATE ROLE cbmall_app WITH LOGIN PASSWORD 'REPLACE_ME' NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- 2) 스키마 사용 권한
GRANT USAGE ON SCHEMA public TO cbmall_app;

-- 3) 앞으로 postgres 롤이 만들 모든 테이블/시퀀스/함수에 대한 기본 권한
--    이 파일을 최초 마이그레이션보다 먼저 실행하므로, 모든 애플리케이션 테이블이
--    여기에 자동으로 걸린다(DDL 권한은 부여하지 않음).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cbmall_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO cbmall_app;
-- 8.6절 PL/pgSQL 함수 실행 권한 (함수가 추가될 때마다 이 파일을 고치지 않아도 되도록 기본값으로)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO cbmall_app;

-- 4) Supabase 기본 권한 회수 — 앞으로 만들어질 객체 (PRD 8.68절 Q-4)
--
-- Supabase는 public 스키마의 신규 객체에 anon·authenticated 권한을 자동 부여한다.
-- Data API 노출 스키마에서 public을 제거하면(8.68절 Q-2) 경로는 막히지만 권한은 남으므로,
-- 권한 자체도 회수해 방어선을 한 겹 더 둔다.
-- (이미 존재하는 객체에 대한 회수는 20260920150000_rls_app_policies 마이그레이션에서 수행)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
