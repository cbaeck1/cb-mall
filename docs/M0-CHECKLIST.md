# M0 선행 작업 체크리스트 (1주차)

PRD 9.1절 M0의 실행용 체크리스트입니다. 각 항목에 **합격 기준**과 **실패 시 대안**을 함께 적었습니다 — 실측 결과에 따라 설계가 바뀌는 항목이 있으므로, 통과 여부만이 아니라 **무엇을 관찰했는지**를 기록해 주세요.

> **이 체크리스트가 존재하는 이유**: 8.51~8.70절 교차 검토에서, PRD 문장만 보면 맞는데 **실제 호스팅 환경에서는 그대로 실행되지 않는** 결정이 여러 건 나왔습니다(8.67 Prepared Statement, 8.68 BYPASSRLS, 8.70 IPv6). 아래 항목 대부분이 그 유형이라 **문서 검토가 아니라 실제 실행으로만** 확인됩니다.

**우선순위**: ①②가 막히면 M2부터 밀립니다. ④는 유일하게 **설계를 되돌릴 수 있는** 항목입니다.

---

## ① 도메인 · DNS · 인증서 — PM + 백엔드

리드 타임(도메인 구입, DNS 전파, ACM 검증)이 있어 **가장 먼저 착수**합니다.

- [ ] 서비스 도메인 확보
- [ ] 운영 `app.` / `api.` DNS 레코드
- [ ] 스테이징 `stg.` / `api-stg.` DNS 레코드
- [ ] **프리뷰용 `*.preview.` 와일드카드 CNAME** (PRD 8.65절 N-1)
- [ ] Vercel 프로젝트에 `*.preview.<도메인>` 등록
- [ ] ACM 인증서 발급(`api.`, `api-stg.`) → ALB 연결
- [ ] 발신 전용 `mail.` 서브도메인 + SPF / DKIM / DMARC (8.13절)
- [ ] 토스페이먼츠 상점 등록 (도메인 확정이 선행 조건)

**실측 — 프리뷰에서 인증이 동작하는가** (8.65절 N-1)

- [ ] CI에서 `vercel alias set <deployment-url> pr-<N>.preview.<도메인>` 실행 성공
- [ ] 그 URL에서 로그인 → Refresh 쿠키가 `Domain=.<도메인>`으로 설정됨
- [ ] 이후 `api-stg.` 요청에 쿠키가 **실려서 감** (브라우저 개발자도구 Network에서 확인)
- [ ] SSR 보호 페이지 진입 시 쿠키가 Next.js 서버까지 도달함

> **합격 기준**: 프리뷰 URL에서 로그인 후 마이페이지가 SSR로 렌더됨
> **실패 시**: 기본 `*.vercel.app`으로는 절대 동작하지 않습니다(다른 사이트로 취급). 도메인 설정을 먼저 끝내야 하며, 그 전까지 프리뷰에서는 **인증이 필요 없는 화면만** 검증 가능합니다.

---

## ② Supabase 환경 구축 — 백엔드

**실행 순서가 중요합니다** (8.68절 정리 과정에서 발견).

- [ ] 스테이징 · 운영 프로젝트 **2개** 생성
- [ ] **각 프로젝트에서** `apps/api/prisma/setup/roles.sql` 실행 — **마이그레이션보다 먼저**
- [ ] `DIRECT_DATABASE_URL` = **Supavisor 세션 모드 풀러** (`aws-0-<region>.pooler.supabase.com:5432`)
- [ ] `DATABASE_URL` = **트랜잭션 모드** (`:6543`) + `?pgbouncer=true`, **`connection_limit` 없음**
- [ ] `prisma migrate deploy` 실행
- [ ] **Data API 노출 스키마에서 `public` 제거** (프로젝트 설정 → API → Exposed schemas)

**실측 — 각각 무엇을 확인하는가**

| 확인 | 합격 기준 | 실패 시 | 근거 |
|---|---|---|---|
| `roles.sql` 실행 | 에러 없이 `cbmall_app` 생성 | — (`NOBYPASSRLS`로 바꿔서 superuser 권한이 불필요해짐) | 8.68 Q-3 |
| `prisma migrate deploy` | **연결 성공 + 마이그레이션 전부 적용** | `ENETUNREACH`/타임아웃이면 URL이 진짜 다이렉트(`db.<ref>`)를 가리키는 것 → 세션 모드 풀러로 교체. 그래도 안 되면 **IPv4 애드온**(유료) | 8.70 S-1 |
| advisory lock | 마이그레이션이 10초 타임아웃 없이 완료 | 세션 모드가 아닌 트랜잭션 모드를 가리키고 있는지 확인 | 8.57 F-5 |
| RLS 정책 생성 | `pg_policies`에 테이블당 `app_all` **1개**, **anon 대상 정책 0개** | `20260920150000_rls_app_policies` 적용 여부 확인 | 8.68 Q-1/Q-3 |
| `cbmall_app` 접속 | 해당 롤로 접속해 **CRUD 정상 동작** | 정책이 안 걸렸거나 GRANT 누락 | 8.68 Q-3 |
| anon 차단 | anon 키로 `/rest/v1/products` 호출 시 **접근 불가** | Data API 노출 스키마 설정 재확인 | 8.68 Q-2 |
| Prepared Statement | 동시 요청 부하에서 **SQLSTATE 42P05 / 26000 미발생** | `?pgbouncer=true` 누락 — 단일 요청으로는 재현 안 되니 반드시 동시 요청으로 | 8.67 P-1 |

---

## ③ react-pdf 스파이크 — 프론트 (타임박스 0.5일)

- [ ] `'use client'` 래퍼(`PdfViewerLoader.tsx`) 안에서 `dynamic(..., { ssr: false })`
- [ ] Server Component인 상품 상세에서 그 래퍼만 import
- [ ] `pdfjs-dist`를 앱의 **직접 의존성**으로 추가
- [ ] `postinstall` 스크립트로 워커 파일을 `public/`에 복사
- [ ] `workerSrc`를 **react-pdf 사용 모듈과 같은 파일에서** 설정
- [ ] `pnpm.overrides`로 `zod` 단일 버전 고정

| 확인 | 합격 기준 | 실패 시 | 근거 |
|---|---|---|---|
| 빌드 | `next build` 통과 | `ssr: false is not allowed...` → 래퍼가 Server Component 안에 있음 | 8.64 M-1 |
| 워커 로딩 | 샘플 PDF가 **실제로 렌더됨** | `Can't resolve pdfjs-dist/build/...` → pnpm 전이 의존성 문제, 직접 의존성으로 | 8.64 M-4 |
| 버전 정합 | 콘솔에 버전 불일치 경고 없음 | "API version does not match the Worker version" → `postinstall` 복사 확인 | 8.64 M-5 |
| zod 단일화 | `pnpm why zod` 결과가 **단일 버전** | `@hookform/resolvers`·`nestjs-zod` 요구 버전 확인 후 overrides 조정 | 8.64 M-4 |
| 구형 브라우저 | 실패 시 **다운로드 링크로 대체 노출** | `Promise.withResolvers` 미지원 — 폴리필 대신 그레이스풀 디그레이드 | 8.64 M-7 |

---

## ④ PDF 텍스트 추출 스파이크 — 백엔드 (타임박스 1일)

> ⚠ **이 항목만 설계를 되돌릴 수 있습니다.** 8.59~8.63절 검색 설계 전체가 "한국어 PDF는 음절 단위로 줄바꿈된다"는 전제 위에 서 있습니다(UAX #14 · 한컴/Word 기본값 근거). **청크 파이프라인을 만들기 전에** 확인해야 합니다.

- [ ] 실제 자사 전자책 **2~3권**으로 `getText({ partial: [n] })` 페이지 순회
- [ ] `PDFParse` 인스턴스 1회 생성 → 재사용 → `destroy()` 패턴 확인
- [ ] 페이지 시작 오프셋 기록 → 청크의 `page_from`/`page_to` 산출

**핵심 관찰 항목 — 결과를 반드시 기록**

- [ ] **줄바꿈이 어디서 끊기는가**
  - 음절 중간(`해리포` + `터`)이 다수 → **8.60절 I-1 ④ 현행 규칙 유지**
  - 어절 경계(`만났다` + `그런데`)가 압도적 → **8.60절 I-1 ④ 재검토 필요**(개행→공백으로 변경), 8.61절 J-6 스니펫 가독성 판단도 함께 바뀜
- [ ] 추출 텍스트가 **NFC인가 NFD인가** (정규화 파이프라인 1단계 검증)
- [ ] 유령 문자(soft hyphen `­`, ZWSP `​`, NBSP) 실제 출현 여부
- [ ] 청크 1,000자 기준 **권당 청크 수** → 8.24절 전환 판단 지표(50만 행) 캘리브레이션
- [ ] 권당 추출 소요 시간이 **60초 타임아웃**(8.33절) 안에 들어오는가
- [ ] 텍스트 레이어가 없는(스캔) PDF 비율 — 8.31절은 OCR을 범위에서 제외했음

---

## ⑤ CI 뼈대 — 백엔드 (1주차 말 ~ 2주차 초)

- [ ] GitHub Actions + **OIDC** (`environment:production`)
- [ ] 환경별 **`concurrency` 그룹** — 배포 직렬화 (8.57절 F-6)
- [ ] **승인 → 마이그레이션 → 배포** 순서 고정 (8.35절)
- [ ] 마이그레이션 실패 시 **IPv6 진단 안내 문구** 출력 (8.70절 S-5)
- [ ] E2E는 **Turborepo 캐시에서 제외** (8.57절)

**아키텍처 경계 자동 검증** (8.35절 Lint 단계)

- [ ] 파괴적 DDL(`DROP COLUMN`/`RENAME`/`NOT NULL` 추가) 검출 (8.57절 F-1)
- [ ] `app/api/**/route.ts` **허용 목록 대조** (8.66절 O-3)
- [ ] `'use server'` 지시문 검출 시 실패 (8.66절 O-5)
- [ ] 신규 `CREATE TABLE`에 **RLS 활성화 + `app_all` 정책**이 함께 있는지 (8.68절 Q-5)
- [ ] 마이그레이션의 `SECURITY DEFINER` 검출 시 실패 (8.68절 Q-6)

---

## ⑥ Vercel 프로젝트 설정 — 프론트

- [ ] **함수 리전 `icn1`(서울)** 고정 — `vercel.json`의 `regions` 또는 프로젝트 설정
- [ ] 보호된 페이지 라우트에 `export const maxDuration = 10`
- [ ] SSR 릴레이 헬퍼에 `AbortSignal.timeout(3초)` + 재시도 없음
- [ ] 개인화 영역 `<Suspense>` 분리
- [ ] `getSsrAccessToken`을 React `cache()`로 감싸기

| 확인 | 합격 기준 | 실패 시 | 근거 |
|---|---|---|---|
| 함수 리전 | SSR 페이지 TTFB가 **서울 기준** | 기본 `iad1`이면 릴레이가 태평양 2회 왕복. **Pro 플랜 이상**에서만 리전 지정 가능 | 8.69 R-1 |
| 저하 동작 | ECS를 일부러 멈췄을 때 **504가 아니라** 로그인 리다이렉트/비로그인 셸 | `AbortSignal` 미적용 | 8.69 R-2 |

---

## 완료 보고

M0 종료 시 아래를 팀에 공유합니다.

- [ ] ④ 줄바꿈 패턴 관찰 결과 — **8.60절 I-1 재검토가 필요한지 여부**
- [ ] ④ 권당 청크 수 — 8.24절 전환 기준 지표 확정치
- [ ] ② 마이그레이션 커넥션 최종 형태 — 세션 모드 풀러로 충분했는지, IPv4 애드온이 필요했는지
- [ ] 막힌 항목과 그로 인한 M2 일정 영향
