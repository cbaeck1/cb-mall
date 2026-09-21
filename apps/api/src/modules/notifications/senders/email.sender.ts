import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

// PRD 8.13절: Resend로 구현(프로덕션은 향후 SES 검토). 외부 API 타임아웃 10초(8.72절 U-5) —
// 재시도 예산이 지켜지려면 개별 시도가 빠르게 실패해야 한다.
export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailSender {
  private readonly logger = new Logger(EmailSender.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    this.client = apiKey ? new Resend(apiKey) : null;
    this.from = this.config.get<string>("MAIL_FROM")!;
    if (!this.client) {
      this.logger.warn("RESEND_API_KEY 미설정 — 이메일은 콘솔에만 출력됩니다(외부 서비스 연동 전 로컬 동작용).");
    }
  }

  async send(payload: EmailPayload): Promise<void> {
    if (!this.client) {
      this.logger.log(`[DEV-EMAIL] to=${payload.to} subject=${payload.subject}`);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 8.72절 U-5
    try {
      const res = await this.client.emails.send(
        { from: this.from, to: payload.to, subject: payload.subject, html: payload.html },
        { signal: controller.signal } as never,
      );
      if (res.error) throw new Error(res.error.message);
    } finally {
      clearTimeout(timeout);
    }
  }
}
