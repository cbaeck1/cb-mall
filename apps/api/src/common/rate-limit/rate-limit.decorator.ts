import { SetMetadata } from "@nestjs/common";

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  keyBy: "ip" | "email"; // email은 body.email 기준(8.7절: 로그인/비밀번호 재설정)
}

export const RATE_LIMIT_KEY = "rateLimit";
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
