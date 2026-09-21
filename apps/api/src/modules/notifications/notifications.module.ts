import { Module } from "@nestjs/common";
import { OutboxService } from "./outbox.service";
import { NotificationsProcessor } from "./notifications.processor";
import { NotificationsCron } from "./notifications.cron";
import { EmailSender } from "./senders/email.sender";
import { SmsSender } from "./senders/sms.sender";
import { PushSender } from "./senders/push.sender";

@Module({
  providers: [OutboxService, NotificationsProcessor, NotificationsCron, EmailSender, SmsSender, PushSender],
  exports: [OutboxService, NotificationsProcessor],
})
export class NotificationsModule {}
