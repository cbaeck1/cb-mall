import { Controller, Get, Header, Query, UseGuards } from "@nestjs/common";
import { searchQuerySchema } from "@cb-mall/shared-types";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { PostgresRateLimitGuard } from "../../common/rate-limit/rate-limit.guard";
import { SearchService } from "./search.service";

// PRD 8.62절: 단일 검색 엔드포인트. K-6: 캐시 금지(no-store). 8.28절: 분당 30회(엔드포인트 단위, 인메모리도 허용되나
// 여러 태스크에서 일관되게 동작하도록 Postgres 기반 가드를 재사용한다).
@Public()
@Controller("products/search")
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @UseGuards(PostgresRateLimitGuard)
  @RateLimit({ limit: 30, windowSeconds: 60, keyBy: "ip" })
  @Header("Cache-Control", "no-store")
  @Get()
  search(@Query() query: Record<string, unknown>) {
    return this.service.search(searchQuerySchema.parse(query));
  }
}
