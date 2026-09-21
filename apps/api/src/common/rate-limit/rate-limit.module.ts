import { Global, Module } from "@nestjs/common";
import { PostgresRateLimitService } from "./postgres-rate-limit.service";
import { PostgresRateLimitGuard } from "./rate-limit.guard";

@Global()
@Module({
  providers: [PostgresRateLimitService, PostgresRateLimitGuard],
  exports: [PostgresRateLimitService, PostgresRateLimitGuard],
})
export class RateLimitModule {}
