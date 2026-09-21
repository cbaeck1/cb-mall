import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { PdfExtractionService } from "./pdf-extraction.service";

@Injectable()
export class PdfExtractionCron {
  private readonly logger = new Logger(PdfExtractionCron.name);

  constructor(
    private readonly service: PdfExtractionService,
    private readonly prisma: PrismaService,
  ) {}

  // 8.12/8.32절: 추출 재시도(최대 2회) — 10분마다
  @Cron("*/10 * * * *")
  async retry(): Promise<void> {
    const n = await this.service.pollAndProcessBatch(10);
    if (n > 0) this.logger.log(`PDF 추출 배치 처리 ${n}건`);
  }

  // 8.32절: 정체(stuck) 감지 — 10분마다 함께 확인
  @Cron("5-55/10 * * * *")
  async detectStuck(): Promise<void> {
    const n = await this.service.markStuckAsFailed();
    if (n > 0) this.logger.warn(`PDF 추출 정체 감지로 FAILED 전환 ${n}건`);
  }

  // 8.32절: 일 1회 실패율 집계, 20% 초과 시 경고 로그(Sentry 연동은 8.24절 참고, 이 프로젝트에서는 로그로 대체)
  @Cron("0 4 * * *")
  async dailyFailureRate(): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [total, failed] = await Promise.all([
      this.prisma.productFullText.count({ where: { updatedAt: { gte: since } } }),
      this.prisma.productFullText.count({ where: { updatedAt: { gte: since }, status: "FAILED" } }),
    ]);
    if (total === 0) return;
    const rate = failed / total;
    if (rate > 0.2) this.logger.error(`PDF 추출 실패율 집계 경고: ${(rate * 100).toFixed(1)}% (${failed}/${total})`);
  }
}
