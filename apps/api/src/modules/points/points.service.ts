import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

interface UserBalanceRow {
  point_balance: number;
}

// FR-6.2, 8.5/8.6절: 적립금 원자적 증감(adjust_point_balance) — 적립은 양수, 사용은 음수 amount.
@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  async adjust(userId: string, amount: number, type: "EARN" | "USE", orderId?: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<UserBalanceRow[]>`
      SELECT point_balance FROM adjust_point_balance(${userId}::uuid, ${amount}::integer);
    `;
    const balanceAfter = rows[0]!.point_balance;
    await this.prisma.pointTransaction.create({ data: { userId, amount, type, orderId, balanceAfter } });
  }

  history(userId: string) {
    return this.prisma.pointTransaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }
}
