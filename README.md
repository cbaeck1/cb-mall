# cb몰

자사 제작 전자책(PDF)을 판매하는 온라인 서점. 설계 근거는 [`PRD.md`](./PRD.md)(8.1~8.75절)를 참고하세요 — 이 저장소의 모든 구현 결정에는 해당 PRD 절 번호가 코드 주석으로 달려 있습니다.

## 구조

```
apps/
  api/     NestJS 백엔드 (인증·상품·주문·결제·엔타이틀먼트·알림·검색·PDF 추출·관리자)
  web/     Next.js 15 App Router 프론트엔드
packages/
  shared-types/    프론트·백엔드 공유 Zod 스키마 (8.40절)
  eslint-config/   공유 ESLint flat config (8.48절)
docs/
  M0-CHECKLIST.md  1주차 선행 작업 체크리스트
scripts/
  ci/check-architecture.mjs   아키텍처 경계 CI 검증 (RLS·BFF 허용목록·Server Actions 금지)
```

## 시작하기

외부 서비스(DB·결제·알림 등) 연동은 [`EXTERNAL_SETUP.md`](./EXTERNAL_SETUP.md)를 먼저 확인하세요.

```bash
pnpm install
pnpm run build       # 전체 빌드 (Turborepo)
pnpm run typecheck
pnpm run lint
pnpm run check:arch   # 아키텍처 경계 검증
```

## 알려진 단순화 (정직하게 기록)

시간 제약상 아래는 PRD가 요구하는 최종 형태보다 단순화되어 있습니다. 프로덕션 투입 전 처리하세요.

| 항목 | 현재 상태 | PRD 원안 | 관련 절 |
|---|---|---|---|
| PDF 텍스트 추출 | 메인 스레드에서 동기 처리 | `piscina` 워커 스레드 분리 | 8.33/8.60 I-8 |
| 검색 상한 카운트 | 애플리케이션에서 후보 200건 병합·정렬 | SQL 레벨 `LIMIT 201` 단일 쿼리 | 8.62 K-5 |
| 판매순 정렬 | 최신순으로 대체(TODO 주석 있음) | 주문 집계 기반 정렬 | 8.27 |
| 프론트 ESLint | Next.js core-web-vitals 규칙 미포함 | `eslint-config-next` 통합 | 8.48 |
| 프론트 env 검증 | 얇은 Zod 래퍼 | `@t3-oss/env-nextjs` | 8.42 |
| 테스트 | 없음(수동 typecheck/lint/build로만 검증) | Vitest/Playwright/Testing Library 전체 커버리지 | 8.45~8.47 |
| Sentry/GA4/UptimeRobot | 미연동 | 8.24/8.44절 | 8.24/8.44 |
| Docker/ECS 배포 설정 | 없음 | Dockerfile + ECS 태스크 정의 | 8.34/8.35 |
| CI 워크플로(GitHub Actions) | 없음(`check:arch` 스크립트만 존재) | 8.35/8.57절 전체 파이프라인 | 8.35 |
