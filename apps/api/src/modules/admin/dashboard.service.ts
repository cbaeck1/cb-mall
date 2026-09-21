import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// PRD FR-7.1: 대시보드(일별 매출, 주문건수 요약, PDF 본문추출 대기/실패 건수 위젯, 검토 대기 주문 건수 위젯)
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayOrders, todayRevenue, needsReviewCount, extractionPending, extractionFailed, notificationFailed] =
      await Promise.all([
        this.prisma.order.count({ where: { status: "PAID", createdAt: { gte: todayStart } } }),
        this.prisma.order.aggregate({
          where: { status: "PAID", createdAt: { gte: todayStart } },
          _sum: { totalAmount: true },
        }),
        this.prisma.order.count({ where: { status: "NEEDS_REVIEW" } }), // 8.71절 T-2
        this.prisma.productFullText.count({ where: { status: "PENDING" } }), // 8.32절
        this.prisma.productFullText.count({ where: { status: "FAILED" } }),
        this.prisma.notificationOutbox.count({ where: { status: "FAILED" } }), // FR-7.7 대상
      ]);

    return {
      todayOrderCount: todayOrders,
      todayRevenue: todayRevenue._sum.totalAmount ?? 0,
      needsReviewCount,
      extractionPending,
      extractionFailed,
      notificationFailedCount: notificationFailed,
    };
  }
}
