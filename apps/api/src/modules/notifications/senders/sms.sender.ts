import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomUUID } from "node:crypto";

// PRD 8.14절: 솔라피(Solapi). SMS/LMS는 maxAttempts=1(사실상 재시도 없음).
// HMAC-SHA256 서명 인증 방식(솔라피 API 규격)을 직접 구현해 SDK 의존을 최소화한다.
export interface SmsPayload {
  to: string;
  text: string;
}

@Injectable()
export class SmsSender {
  private readonly logger = new Logger(SmsSender.name);
  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  private readonly senderNumber?: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>("SOLAPI_API_KEY") || undefined;
    this.apiSecret = this.config.get<string>("SOLAPI_API_SECRET") || undefined;
    this.senderNumber = this.config.get<string>("SOLAPI_SENDER_NUMBER") || undefined;
    if (!this.apiKey) {
      this.logger.warn("SOLAPI_API_KEY 미설정 — SMS는 콘솔에만 출력됩니다(외부 서비스 연동 전 로컬 동작용).");
    }
  }

  async send(payload: SmsPayload): Promise<void> {
    if (!this.apiKey || !this.apiSecret || !this.senderNumber) {
      this.logger.log(`[DEV-SMS] to=${payload.to} text=${payload.text}`);
      return;
    }
    const date = new Date().toISOString();
    const salt = randomUUID();
    const signature = createHmac("sha256", this.apiSecret).update(date + salt).digest("hex");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch("https://api.solapi.com/messages/v4/send", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `HMAC-SHA256 apiKey=${this.apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
        },
        body: JSON.stringify({ message: { to: payload.to, from: this.senderNumber, text: payload.text } }),
      });
      if (!res.ok) throw new Error(`SOLAPI_SEND_FAILED_${res.status}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
