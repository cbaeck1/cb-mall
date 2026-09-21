import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as admin from "firebase-admin";
import { PrismaService } from "../../../prisma/prisma.service";

// PRD 8.16절: FCM. 발송 실패(UNREGISTERED 등) 시 토큰을 정리한다. 재시도는 하지 않는다(maxAttempts=1).
// 8.75절 P3: 본문에 상품명(책 제목)을 넣지 않는다 — 잠금화면에 그대로 노출되기 때문.
export interface PushPayload {
  fcmToken: string;
  title: string;
  body: string;
}

@Injectable()
export class PushSender {
  private readonly logger = new Logger(PushSender.name);
  private initialized = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const json = this.config.get<string>("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (json && admin.apps.length === 0) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
      this.initialized = true;
    }
    if (!this.initialized) {
      this.logger.warn("FIREBASE_SERVICE_ACCOUNT_JSON 미설정 — 푸시는 콘솔에만 출력됩니다(외부 서비스 연동 전).");
    }
  }

  async send(payload: PushPayload): Promise<void> {
    if (!this.initialized) {
      this.logger.log(`[DEV-PUSH] token=${payload.fcmToken.slice(0, 8)}... title=${payload.title}`);
      return;
    }
    try {
      await admin.messaging().send({
        token: payload.fcmToken,
        notification: { title: payload.title, body: payload.body },
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "messaging/registration-token-not-registered") {
        await this.prisma.pushSubscription.deleteMany({ where: { fcmToken: payload.fcmToken } });
      }
      throw err;
    }
  }
}
