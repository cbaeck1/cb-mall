# 외부 서비스 연동 체크리스트

코드 구축은 완료되었습니다. 이 문서는 **실제로 서비스를 띄우기 위해 지금 처리해야 할 외부 가입·설정**을 한 곳에 모은 것입니다(요청하신 대로 "일괄 처리"용). 각 항목은 `.env.example` 파일의 어떤 변수와 연결되는지 명시했습니다.

각 값을 발급받으면 `apps/api/.env`와 `apps/web/.env.local`(로컬) 또는 AWS Secrets Manager/Vercel 환경변수(운영)에 채워 넣으면 바로 동작합니다. 코드는 이미 이 변수들을 읽도록 되어 있습니다 — `apps/api/src/config/env.validation.ts`가 부팅 시점에 형식을 검증합니다.

---

## 1. 필수 — 이게 없으면 아예 기동/배포가 안 됨

| # | 항목 | 관련 env 변수 | 비고 |
|---|---|---|---|
| 1 | **도메인 확보** | `REFRESH_COOKIE_DOMAIN`, `CORS_ALLOWED_ORIGINS`, `NEXT_PUBLIC_API_ORIGIN`, `FRONTEND_ORIGIN` | 8.65절: `app.`/`api.` 서브도메인. 로컬 개발은 도메인 없이 `localhost` 그대로 사용 가능(현재 `.env.example` 기본값) |
| 2 | **Supabase 프로젝트 2개**(스테이징·운영) | `DATABASE_URL`, `DIRECT_DATABASE_URL` | supabase.com에서 생성 → Settings → Database에서 두 연결 문자열 확보. **`DATABASE_URL`은 반드시 `:6543` + `?pgbouncer=true`(트랜잭션 모드), `DIRECT_DATABASE_URL`은 `:5432` 세션 모드 풀러**(8.70절 — 진짜 다이렉트 커넥션은 IPv6 전용이라 대부분의 로컬/CI 환경에서 연결 실패함) |
| 3 | 각 Supabase 프로젝트에서 `apps/api/prisma/setup/roles.sql` 실행 | — | SQL Editor에 붙여넣고 실행. `cbmall_app` 롤 비밀번호를 위 `DATABASE_URL`/`DIRECT_DATABASE_URL`의 실제 값으로 교체 |
| 4 | 마이그레이션 적용 | — | `pnpm --filter @cb-mall/api run db:migrate:deploy` |
| 5 | Supabase Data API 노출 스키마에서 `public` 제거 | — | 프로젝트 설정 → API → Exposed schemas (8.68절 Q-2) |
| 6 | **JWT 시크릿** | `JWT_ACCESS_SECRET` | `openssl rand -hex 32` 등으로 32자 이상 무작위 값 생성 |
| 7 | **서버 간 공유 시크릿 2개** | `SSR_RELAY_SHARED_SECRET`(백엔드+프론트 동일), `CACHE_REVALIDATE_SHARED_SECRET`(백엔드+프론트 동일) | 무작위 문자열 생성, 양쪽 앱에 동일하게 설정 |
| 8 | **토스페이먼츠 가맹점 가입** | `TOSS_SECRET_KEY`(백엔드), `NEXT_PUBLIC_TOSS_CLIENT_KEY`(프론트) | https://developers.tosspayments.com — 테스트 키는 가입 즉시 발급됨. 결제를 실제로 받으려면 사업자 심사 필요(리드 타임 있음, 가장 먼저 신청 권장) |
| 9 | **AWS 계정 + S3 버킷 2개** | `AWS_REGION`(기본 ap-northeast-2), `S3_PRIVATE_BUCKET`, `S3_PUBLIC_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | 비공개 버킷(원본 PDF) + 공개 버킷(샘플·표지). 공개 버킷은 CORS 설정 필요(허용 오리진에 `NEXT_PUBLIC_API_ORIGIN`·Vercel 프리뷰 도메인 포함) |

## 2. 알림 채널 — 없어도 기동은 되지만 해당 기능이 콘솔 로그로만 동작(코드에 이미 폴백 있음)

| # | 항목 | 관련 env 변수 | 폴백 동작 |
|---|---|---|---|
| 10 | **Resend 계정**(이메일) | `RESEND_API_KEY`, `MAIL_FROM` | 키가 없으면 실제 발송 대신 서버 로그에 `[DEV-EMAIL]`로 출력(`apps/api/src/modules/notifications/senders/email.sender.ts`) |
| 11 | **솔라피 계정**(SMS) | `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_NUMBER` | 발신번호 사전등록 필요(사업자 서류 인증, 영업일 1~2일). 미설정 시 `[DEV-SMS]` 로그로 대체 |
| 12 | **Firebase 프로젝트**(웹 푸시) | `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 비공개 키 생성(JSON 전체를 문자열로 저장). 미설정 시 `[DEV-PUSH]` 로그로 대체 |

## 3. 운영 배포 시 필요(로컬 개발에는 불필요)

| # | 항목 | 비고 |
|---|---|---|
| 13 | KMS 키 | `KMS_KEY_ID` — MFA secret 암호화(8.19/8.30절). 미설정 시 로컬 전용 대체 암호화로 자동 폴백하며 **부팅 시 운영 환경(`NODE_ENV=production`)에서는 이 값이 없으면 실패**하도록 만들어 뒀습니다(`kms-encryption.service.ts`의 `assertProductionSafe`) |
| 14 | Vercel 프로젝트 | 함수 리전을 `icn1`(서울)로 설정(`apps/web/vercel.json`에 이미 명시됨, 8.69절 R-1) |
| 15 | AWS ECS/ECR, WAF, ALB | PRD 10절 "착수 전 준비물" C그룹 참고 |
| 16 | Sentry, UptimeRobot, GA4 | 코드에는 아직 연동되지 않음(§ 아래 "완료 후 남은 작업" 참고) |

## 4. 최초 관리자 계정

환경변수에 아래 둘을 채우고 시드 스크립트를 실행하면 SUPER_ADMIN 계정이 생성됩니다(8.20절 — 관리자는 초대 기반 생성만 허용되므로 최초 1명은 시드로 만듭니다).

```bash
# apps/api/.env에 설정
SEED_SUPER_ADMIN_EMAIL="실제 관리자 이메일"
SEED_SUPER_ADMIN_PASSWORD="강력한 임시 비밀번호"
```

```bash
pnpm --filter @cb-mall/api run db:seed
```

로그인 직후 반드시 `/mypage/mfa`(또는 관리자 초대 수락 후 흐름)에서 MFA를 설정하세요 — 관리자는 MFA가 필수입니다(8.19절, 미설정 상태는 코드에서 강제 차단하지 않으므로 운영 절차로 지켜야 합니다. 강제 차단이 필요하면 로그인 응답에 `mfaEnabled: false` + role이 admin인 경우 프론트에서 리다이렉트하는 로직을 `login-client.tsx`에 추가하십시오 — 현재는 마이페이지 진입 시 안내만 됩니다).

## 5. 로컬에서 지금 바로 실행해보기

```bash
pnpm install
pnpm --filter @cb-mall/api run db:generate
# 위 1~5번(DB) 완료 후:
pnpm --filter @cb-mall/api run db:migrate:deploy
pnpm --filter @cb-mall/api run db:seed

pnpm --filter @cb-mall/api run dev    # http://localhost:4000, /docs 에 Swagger
pnpm --filter @cb-mall/web run dev    # http://localhost:3000
```

`apps/api/.env.example`과 `apps/web/.env.example`을 각각 `.env` / `.env.local`로 복사한 뒤 위 표의 값을 채우면 됩니다(이미 로컬 검증용 더미 값이 예시로 채워져 있습니다).
