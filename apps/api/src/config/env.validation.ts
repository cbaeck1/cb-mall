import { z } from "zod";

// PRD 8.42절: Zod 스키마 기반 validate, 검증 실패 시 process.exit(1)
// 8.70절 S-2: 두 DB URL의 형식으로 혼동을 차단 — DATABASE_URL은 pgbouncer=true 필수,
//   DIRECT_DATABASE_URL은 :6543/pgbouncer=true 포함 시 거부.
export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),

    DATABASE_URL: z.string().url(),
    DIRECT_DATABASE_URL: z.string().url(),

    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET은 32자 이상이어야 합니다"),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
    SSR_RELAY_SHARED_SECRET: z.string().min(16),
    CACHE_REVALIDATE_SHARED_SECRET: z.string().min(16),
    REFRESH_COOKIE_DOMAIN: z.string().optional(), // 8.7/8.65절: 운영에서는 ".cbmall.example" 형태. 로컬은 미설정(host-only).

    AWS_REGION: z.string().default("ap-northeast-2"),
    S3_PRIVATE_BUCKET: z.string().min(1),
    S3_PUBLIC_BUCKET: z.string().min(1),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    KMS_KEY_ID: z.string().optional(),

    TOSS_SECRET_KEY: z.string().min(1),

    RESEND_API_KEY: z.string().optional(),
    MAIL_FROM: z.string().min(1),
    SOLAPI_API_KEY: z.string().optional(),
    SOLAPI_API_SECRET: z.string().optional(),
    SOLAPI_SENDER_NUMBER: z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

    CORS_ALLOWED_ORIGINS: z.string().min(1),
    FRONTEND_ORIGIN: z.string().url().default("http://localhost:3000"), // 알림 본문 내 링크 생성(8.58절 G-5)

    SENTRY_DSN: z.string().optional(),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    SEED_SUPER_ADMIN_EMAIL: z.string().email().optional(),
    SEED_SUPER_ADMIN_PASSWORD: z.string().min(10).optional(),
  })
  .superRefine((env, ctx) => {
    if (!env.DATABASE_URL.includes("pgbouncer=true")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message: "런타임 DATABASE_URL은 반드시 ?pgbouncer=true를 포함해야 합니다 (PRD 8.67절 P-1)",
      });
    }
    if (env.DIRECT_DATABASE_URL.includes(":6543") || env.DIRECT_DATABASE_URL.includes("pgbouncer=true")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DIRECT_DATABASE_URL"],
        message:
          "DIRECT_DATABASE_URL은 세션 모드(5432) 풀러여야 합니다. :6543/pgbouncer=true는 허용되지 않습니다 (PRD 8.70절 S-1/S-2)",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    console.error("❌ 환경변수 검증 실패 (PRD 8.42절):\n", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}
