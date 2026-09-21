#!/usr/bin/env node
// PRD 8.35/8.66/8.68절: 아키텍처 경계를 CI에서 자동 검증한다.
//   ① 모든 테이블이 (마이그레이션 히스토리 전체를 통틀어) RLS 활성화 + cbmall_app 통과 정책을 갖는지 (8.68절 Q-5)
//   ② 마이그레이션에 SECURITY DEFINER가 있으면 실패 (8.68절 Q-6)
//   ③ app/api/**/route.ts 허용 목록 대조 — BFF는 0개, revalidate 웹훅만 허용 (8.66절 O-3)
//   ④ 소스에서 'use server' 지시문 검출 시 실패 (8.66절 O-5)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
let failed = false;

function fail(message) {
  console.error(`❌ ${message}`);
  failed = true;
}

function walk(dir, filter) {
  const results = [];
  if (!statOrNull(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
      results.push(...walk(full, filter));
    } else if (filter(full)) {
      results.push(full);
    }
  }
  return results;
}

function statOrNull(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

// ① / ② 마이그레이션 검사 — 디렉터리명이 타임스탬프 접두라 정렬 = 시간순
const migrationsDir = join(ROOT, "apps/api/prisma/migrations");
const migrationFiles = walk(migrationsDir, (f) => f.endsWith("migration.sql")).sort();

// RateLimitBucket 등: RLS 우회 롤(cbmall_app)만 접근하는 순수 인프라 테이블은 정책이 필요 없다.
const RLS_EXEMPT = new Set(["rate_limit_buckets", "payment_webhook_events"]);
// setup/roles.sql이 만드는 동적 DO 블록의 시그니처(테이블명이 %I로 런타임 치환되어 정적 스캔 불가) —
// 이 패턴이 있으면 그 시점까지 만들어진 모든 public 테이블에 정책이 걸린 것으로 간주한다.
const DYNAMIC_POLICY_SIGNATURE = /EXECUTE\s+format\(\s*'CREATE POLICY app_all ON public\.%I/i;

const tablesCreated = new Set();
const tablesRlsEnabled = new Set();
const tablesPolicyCovered = new Set();

for (const file of migrationFiles) {
  const sql = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);

  if (/SECURITY DEFINER/i.test(sql)) {
    fail(`${rel}: SECURITY DEFINER 함수가 감지되었습니다 (PRD 8.68절 Q-6 — 최소권한 설계 위반).`);
  }

  for (const m of sql.matchAll(/CREATE TABLE\s+"?(\w+)"?/gi)) tablesCreated.add(m[1]);
  for (const m of sql.matchAll(/ALTER TABLE\s+(?:public\.)?"?(\w+)"?\s+ENABLE ROW LEVEL SECURITY/gi)) {
    tablesRlsEnabled.add(m[1]);
  }
  for (const m of sql.matchAll(/CREATE POLICY\s+\w+\s+ON\s+(?:public\.)?"?(\w+)"?/gi)) {
    tablesPolicyCovered.add(m[1]);
  }
  if (DYNAMIC_POLICY_SIGNATURE.test(sql)) {
    for (const t of tablesCreated) tablesPolicyCovered.add(t); // 이 시점까지의 전 테이블 커버
  }
}

for (const table of tablesCreated) {
  if (RLS_EXEMPT.has(table)) continue;
  if (!tablesRlsEnabled.has(table)) {
    fail(`테이블 "${table}"에 RLS 활성화가 없습니다 (PRD 8.68절 Q-5). 마이그레이션 히스토리 전체를 확인하세요.`);
  } else if (!tablesPolicyCovered.has(table)) {
    fail(`테이블 "${table}"은 RLS는 켜져 있으나 cbmall_app 통과 정책이 없습니다 (PRD 8.68절 Q-3/Q-5).`);
  }
}

// ③ / ④ 프론트엔드 검사 (apps/web이 아직 없으면 건너뜀)
const webApiDir = join(ROOT, "apps/web/src/app/api");
const ALLOWED_ROUTES = ["revalidate/route.ts"]; // 8.23/8.51절 C-6: 캐시 무효화 웹훅 수신기 하나만 허용
if (statOrNull(webApiDir)) {
  const routeFiles = walk(webApiDir, (f) => f.endsWith("route.ts"));
  for (const file of routeFiles) {
    const rel = relative(webApiDir, file).replace(/\\/g, "/");
    if (!ALLOWED_ROUTES.includes(rel)) {
      fail(`apps/web/src/app/api/${rel}: 허용되지 않은 Route Handler입니다 (PRD 8.66절 O-1/O-3 — BFF는 0개).`);
    }
  }

  const sourceFiles = walk(join(ROOT, "apps/web/src"), (f) => f.endsWith(".ts") || f.endsWith(".tsx"));
  for (const file of sourceFiles) {
    const content = readFileSync(file, "utf8");
    if (/^\s*["']use server["']/m.test(content)) {
      fail(`${relative(ROOT, file)}: 'use server' 지시문이 감지되었습니다 (PRD 8.66절 O-5 — Server Actions 미사용).`);
    }
  }
}

if (failed) {
  console.error("\n아키텍처 경계 검증 실패. PRD 8절 '결정 간 의존 관계' 표를 확인하세요.");
  process.exit(1);
} else {
  console.log("✅ 아키텍처 경계 검증 통과");
}
