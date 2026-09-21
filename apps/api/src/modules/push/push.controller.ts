import { Body, Controller, Delete, Post } from "@nestjs/common";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";

// PRD 8.16절: FCM 등록 토큰 저장/해제
@Controller("push-subscriptions")
export class PushController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async register(@CurrentUser() user: AuthenticatedUser, @Body("fcmToken") fcmToken: string, @Body("userAgent") userAgent?: string) {
    await this.prisma.pushSubscription.upsert({
      where: { fcmToken },
      create: { userId: user.id, fcmToken, userAgent },
      update: { userId: user.id, userAgent },
    });
    return { ok: true };
  }

  @Delete()
  async unregister(@Body("fcmToken") fcmToken: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { fcmToken } });
    return { ok: true };
  }
}
