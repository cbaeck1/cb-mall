import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TossClient } from "../../common/toss/toss-client";
import { EntitlementsService } from "../entitlements/entitlements.service";
import { OutboxService } from "../notifications/outbox.service";
import { PostgresRateLimitService } from "../../common/rate-limit/postgres-rate-limit.service";
import type { ConfirmPaymentInput } from "@cb-mall/shared-types";

// PRD 8.8/8.9/8.71절: 서버 승인(confirm) + 서명 없는 웹훅 재조회 검증.
// 8.71절 T-1: 웹훅 핸들러가 결제 이후 워크플로 전체(주문 PAID 전이 + 엔타이틀먼트 생성 + outbox 생성)를
//            멱등하게 완결한다. 응답 코드를 3갈래로 분리한다 — 중복=200 / 일시장애=5xx(토스 재시도를
//            자동 복구 장치로 활용) / 재조회 불일치=200+경고.
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private static readonly DEDUPE_WINDOW_MS = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly toss: TossClient,
    private readonly entitlements: EntitlementsService,
    private readonly outbox: OutboxService,
    private readonly rateLimit: PostgresRateLimitService,
  ) {}

  async confirm(input: ConfirmPaymentInput, idempotencyKey: string): Promise<{ orderId: string }> {
    const order = await this.prisma.order.findUnique({ where: { tossOrderId: input.orderId } });
    if (!order) throw new NotFoundException("ORDER_NOT_FOUND");
    if (order.status === "PAID") return { orderId: order.id }; // 멱등: 이미 완료된 확정 재요청
    if (order.status !== "PENDING") throw new BadRequestException("ORDER_NOT_PAYABLE");
    if (order.totalAmount !== input.amount) throw new BadRequestException("AMOUNT_MISMATCH"); // 8.71절 T-4와 동일 원칙

    const payment = await this.toss.confirm(
      { paymentKey: input.paymentKey, orderId: input.orderId, amount: input.amount },
      idempotencyKey,
    );
    if (payment.status !== "DONE") throw new BadRequestException(`PAYMENT_NOT_DONE_${payment.status}`);

    await this.completeOrderWorkflow(order.id, input.paymentKey);
    return { orderId: order.id };
  }

  async handleWebhook(eventType: string, data: { paymentKey: string; orderId: string; status: string; totalAmount: number }) {
    if (eventType !== "PAYMENT_STATUS_CHANGED") return; // 다른 이벤트 타입은 이번 범위 밖(8.8절)

    // 8.71절 T-3 ①: 모르는 orderId → 재조회 없이 200
    const order = await this.prisma.order.findUnique({ where: { tossOrderId: data.orderId } });
    if (!order) return;

    // 8.71절 T-3 ②: 이미 본 이벤트 → 재조회 없이 200
    const recentDuplicate = await this.prisma.paymentWebhookEvent.findFirst({
      where: {
        paymentKey: data.paymentKey,
        reportedStatus: data.status,
        receivedAt: { gte: new Date(Date.now() - PaymentsService.DEDUPE_WINDOW_MS) },
      },
    });
    if (recentDuplicate) return;

    const eventRow = await this.prisma.paymentWebhookEvent.create({
      data: { paymentKey: data.paymentKey, reportedStatus: data.status },
    });

    // 8.71절 T-3/8.74절 W-2: 속도 제한은 "재조회를 수반하는 요청"에만 건다 — 여기까지 온 요청은
    // 이미 싱글 필터(모르는 orderId·중복 이벤트)를 통과한 실제 재조회 대상이다. IP 전체가 아니라
    // 이 지점(paymentKey 단위)에서 제한해야, 전체 요청에 제한을 걸었을 때 T-1이 유도한 정상적인
    // 토스 재시도 폭주까지 함께 막아버리는 실수를 피할 수 있다.
    const allowed = await this.rateLimit.consume(`webhook-requery:${data.paymentKey}`, 20, 60);
    if (!allowed) {
      this.logger.warn(`웹훅 재조회 속도 제한 초과 paymentKey=${data.paymentKey}`);
      return;
    }

    // 8.71절 T-1: 재조회 자체가 실패(네트워크/DB) → 5xx로 토스 재시도를 유도(자동 복구 장치)
    let verified;
    try {
      verified = await this.toss.getPayment(data.paymentKey);
    } catch (err) {
      this.logger.error(`웹훅 재조회 실패 paymentKey=${data.paymentKey}: ${err}`);
      throw new InternalServerErrorException("PAYMENT_REQUERY_FAILED");
    }

    // 8.71절 T-4: 대조 4항목 — orderId / 금액(우리 계산값) / status / paymentKey
    const mismatch =
      verified.orderId !== data.orderId || verified.paymentKey !== data.paymentKey || verified.totalAmount !== order.totalAmount;
    if (mismatch) {
      await this.prisma.paymentWebhookEvent.update({
        where: { id: eventRow.id },
        data: { verifiedStatus: verified.status, processedAt: new Date() },
      });
      this.logger.warn(`웹훅 재조회 불일치(위조 의심) paymentKey=${data.paymentKey} order=${order.id}`);
      return; // 200 — 재시도해도 결과가 같으므로 붙잡지 않는다
    }

    await this.prisma.paymentWebhookEvent.update({
      where: { id: eventRow.id },
      data: { verifiedStatus: verified.status, processedAt: new Date() },
    });

    if (verified.status !== "DONE") return; // 그 외 상태는 기록만

    if (order.status === "CANCELLED") {
      // 8.71절 T-2: 30분 자동취소 이후 뒤늦게 결제 확인 — 자동 판단하지 않고 관리자 검토로
      await this.flagNeedsReview(order.id, data.paymentKey);
      return;
    }

    await this.completeOrderWorkflow(order.id, data.paymentKey); // 멱등 — 이미 PAID면 내부에서 스킵
  }

  private async completeOrderWorkflow(orderId: string, paymentKey: string): Promise<void> {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status !== "PAID") {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: "PAID", tossPaymentKey: paymentKey, paidAt: new Date() },
      });
    }
    await this.entitlements.createForOrder(orderId); // 멱등(이미 있으면 건너뜀)
    await this.enqueueOrderConfirmationIfNeeded(orderId);
  }

  private async enqueueOrderConfirmationIfNeeded(orderId: string): Promise<void> {
    const already = await this.prisma.notificationOutbox.findFirst({
      where: { template: "order_confirmation", payload: { path: ["orderId"], equals: orderId } },
    });
    if (already) return;
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const email = order.userId
      ? (await this.prisma.user.findUnique({ where: { id: order.userId } }))?.email
      : order.guestEmail;
    if (!email) return;
    await this.outbox.enqueue({
      channel: "EMAIL",
      recipientRef: email,
      template: "order_confirmation",
      payload: { orderId },
      provider: "resend",
    });
  }

  private async flagNeedsReview(orderId: string, paymentKey: string): Promise<void> {
    // paymentKey를 미리 저장해 둔다 — 관리자가 나중에 REFUND를 선택하면 이 값으로 토스 취소를 호출한다.
    await this.prisma.order.update({ where: { id: orderId }, data: { status: "NEEDS_REVIEW", tossPaymentKey: paymentKey } });
    const admins = await this.prisma.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true } });
    for (const admin of admins) {
      await this.outbox.enqueue({
        channel: "EMAIL",
        recipientRef: admin.email,
        template: "order_needs_review", // TODO: templates.ts에 렌더러 추가 필요(관리자 알림용, 8.71절 T-2)
        payload: { orderId },
        provider: "resend",
      });
    }
  }

  async refund(orderId: string, reason: string): Promise<void> {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!order.tossPaymentKey) throw new BadRequestException("NO_PAYMENT_TO_REFUND");
    await this.toss.cancel(order.tossPaymentKey, reason);
    await this.prisma.order.update({ where: { id: orderId }, data: { status: "REFUNDED" } });
  }
}
