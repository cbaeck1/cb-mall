import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { InquiriesService } from "./inquiries.service";
import { InquiriesController } from "./inquiries.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [InquiriesController],
  providers: [InquiriesService],
})
export class InquiriesModule {}
