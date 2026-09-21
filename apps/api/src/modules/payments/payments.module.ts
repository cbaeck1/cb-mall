import { Module } from "@nestjs/common";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { TossClient } from "../../common/toss/toss-client";

@Module({
  imports: [EntitlementsModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, TossClient],
  exports: [PaymentsService, TossClient],
})
export class PaymentsModule {}
