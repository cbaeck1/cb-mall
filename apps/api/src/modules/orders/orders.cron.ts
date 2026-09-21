import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { OrdersService } from "./orders.service";

@Injectable()
export class OrdersCron {
  private readonly logger = new Logger(OrdersCron.name);
  constructor(private readonly service: OrdersService) {}

  // PRD 8.8/8.12절: PENDING 주문 자동 취소 — 5분마다 확인(30분 경과 건 처리)
  @Cron("*/5 * * * *")
  async autoCancel(): Promise<void> {
    const n = await this.service.autoCancelStalePending();
    if (n > 0) this.logger.log(`PENDING 주문 자동 취소 ${n}건`);
  }
}
