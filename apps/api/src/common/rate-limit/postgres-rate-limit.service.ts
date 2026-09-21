import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// PRD 8.11절: 여러 ECS 태스크에 걸쳐 정확히 동작해야 하는 속도 제한(로그인/비밀번호 재설정 등)은
// 인메모리가 아니라 Postgres 원자적 UPSERT로 처리한다. 신규 인프라(Redis 등) 없이 해결.
@Injectable()
export class PostgresRateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  // 반환값이 true면 허용, false면 초과(429)
  async consume(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limit_buckets (key, count, window_start, expires_at)
      VALUES (${key}, 1, now(), now() + (${windowSeconds}::text || ' seconds')::interval)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limit_buckets.expires_at < now() THEN 1 ELSE rate_limit_buckets.count + 1 END,
        window_start = CASE WHEN rate_limit_buckets.expires_at < now() THEN now() ELSE rate_limit_buckets.window_start END,
        expires_at = CASE WHEN rate_limit_buckets.expires_at < now()
          THEN now() + (${windowSeconds}::text || ' seconds')::interval
          ELSE rate_limit_buckets.expires_at END
      RETURNING count;
    `;
    return (rows[0]?.count ?? 0) <= limit;
  }
}
