import { z } from "zod";

// FR-3.1~3.2: 장바구니 → 주문서. 전자책은 수량 개념이 없어(중복 구매 방지, FR-2.1) productId 집합으로 다룬다.
// 비회원 결제(FR-4.3)를 허용하므로 guestEmail을 선택적으로 받는다 — 없으면 로그인 사용자로 간주(서버에서 검증).
export const checkoutSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1, "상품을 선택해 주세요").max(50),
  couponCode: z.string().trim().max(40).optional(),
  guestEmail: z.string().trim().toLowerCase().email().optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

// 8.8절: 서버 승인(confirm) 2단계 — 위젯이 돌려준 값을 그대로 다시 보냄, Idempotency-Key는 헤더로 별도 전달
export const confirmPaymentSchema = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(1), // 우리 주문 PK가 아니라 토스에 전달한 orderId 문자열
  amount: z.number().int().positive(),
});
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;

// FR-6.1 쿠폰 검증(적용 전 미리보기)
export const couponValidateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  productIds: z.array(z.string().uuid()).min(1),
});
export type CouponValidateInput = z.infer<typeof couponValidateSchema>;

// FR-6.1 관리자 쿠폰 발급 — apps/api/prisma/schema.prisma의 Coupon 모델과 필드명을 맞춘다.
export const couponCreateSchema = z
  .object({
    code: z.string().trim().min(1).max(40),
    type: z.enum(["FIXED", "PERCENT"]),
    value: z.number().int().positive(),
    minOrderAmount: z.number().int().nonnegative().default(0),
    validFrom: z.coerce.date(),
    validTo: z.coerce.date(),
    usageLimit: z.number().int().positive().optional(),
  })
  .refine((v) => v.validTo > v.validFrom, { message: "validTo는 validFrom보다 이후여야 합니다", path: ["validTo"] });
export type CouponCreateInput = z.infer<typeof couponCreateSchema>;

// FR-3.3 주문 관리(상태 변경) — 8.71절 T-2: NEEDS_REVIEW는 관리자만 PAID/REFUNDED로 전이시킬 수 있음
export const orderStatusUpdateSchema = z.object({
  status: z.enum(["PAID", "CANCELLED", "REFUNDED"]),
  reason: z.string().trim().max(500).optional(),
});
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;

// FR-4.3 비회원 다운로드 재발급(이메일 일회성 링크)
export const guestDownloadRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  orderId: z.string().uuid(),
});
export type GuestDownloadRequestInput = z.infer<typeof guestDownloadRequestSchema>;
