import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

// PRD 8.8절: 토스페이먼츠 서버 승인(confirm) 2단계 + Idempotency-Key. 시크릿키는 Secrets Manager 보관 전제.
export interface TossPayment {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  method?: string;
  approvedAt?: string;
}

const TOSS_API_BASE = "https://api.tosspayments.com/v1";
const TIMEOUT_MS = 10_000; // 8.72절 U-5와 동일한 원칙: 외부 호출은 빠르게 실패해야 한다.

@Injectable()
export class TossClient {
  private readonly authHeader: string;

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.get<string>("TOSS_SECRET_KEY")!;
    this.authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
  }

  private async request<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${TOSS_API_BASE}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
          ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
          ...init.headers,
        },
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        const err = new Error(body?.message ?? `TOSS_API_ERROR_${res.status}`);
        (err as { status?: number }).status = res.status;
        throw err;
      }
      return body as T;
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") {
        throw new InternalServerErrorException("TOSS_API_TIMEOUT");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  confirm(params: { paymentKey: string; orderId: string; amount: number }, idempotencyKey: string) {
    return this.request<TossPayment>("/payments/confirm", {
      method: "POST",
      body: JSON.stringify(params),
      idempotencyKey,
    });
  }

  // 8.71절 T-1: 웹훅 페이로드를 신뢰하지 않고 이 조회 API로 재검증한다.
  getPayment(paymentKey: string) {
    return this.request<TossPayment>(`/payments/${paymentKey}`, { method: "GET" });
  }

  cancel(paymentKey: string, cancelReason: string) {
    return this.request<TossPayment>(`/payments/${paymentKey}/cancel`, {
      method: "POST",
      body: JSON.stringify({ cancelReason }),
    });
  }
}
