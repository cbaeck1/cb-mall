import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { EntitlementsService } from "./entitlements.service";
import { EntitlementsController } from "./entitlements.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [EntitlementsController],
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
