import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { AdminAccountsService } from "./admin-accounts.service";
import { AdminAccountsController } from "./admin-accounts.controller";
import { DashboardService } from "./dashboard.service";
import { DashboardController } from "./dashboard.controller";
import { AuditLogController } from "./audit-log.controller";
import { AdminNotificationsController } from "./admin-notifications.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [AdminAccountsController, DashboardController, AuditLogController, AdminNotificationsController],
  providers: [AdminAccountsService, DashboardService],
})
export class AdminModule {}
