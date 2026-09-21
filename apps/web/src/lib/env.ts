import { z } from "zod";

// PRD 8.42절: 프론트도 필수 환경변수를 빌드 시점에 검증한다(원안은 @t3-oss/env-nextjs이나,
// 의존성을 늘리지 않기 위해 여기서는 동등한 역할의 얇은 Zod 래퍼로 대체했다 — 알려진 단순화).
const envSchema = z.object({
  NEXT_PUBLIC_API_ORIGIN: z.string().url(),
  NEXT_PUBLIC_TOSS_CLIENT_KEY: z.string().min(1),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_ORIGIN: process.env.NEXT_PUBLIC_API_ORIGIN,
  NEXT_PUBLIC_TOSS_CLIENT_KEY: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
});
