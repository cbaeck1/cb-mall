import { Module } from "@nestjs/common";
import { CouponsModule } from "../coupons/coupons.module";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { PaymentsModule } from "../payments/payments.module";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { OrdersCron } from "./orders.cron";

@Module({
  imports: [CouponsModule, EntitlementsModule, PaymentsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersCron],
})
export class OrdersModule {}
