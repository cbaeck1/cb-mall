import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";

// PRD 8.24절: ALB 헬스체크 + UptimeRobot(외부 업타임 모니터링) 대상 엔드포인트
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1;`;
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
