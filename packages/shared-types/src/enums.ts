// 각 값은 apps/api/prisma/schema.prisma의 enum과 1:1로 맞춘다.
// Prisma Client를 프론트에서 직접 import할 수 없으므로(8.3절: NestJS가 API 전담) 문자열 리터럴로 복제한다.
// 스키마에 값을 추가/삭제하면 이 파일도 함께 고쳐야 한다 — 8절 "결정 간 의존 관계" 표의 연장선.

export const ROLE = ["CUSTOMER", "ADMIN", "SUPER_ADMIN"] as const;
export type Role = (typeof ROLE)[number];

export const PRODUCT_STATUS = ["ON_SALE", "SUSPENDED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUS)[number];

export const REVISION_TYPE = ["ERRATA", "MAJOR"] as const;
export type RevisionType = (typeof REVISION_TYPE)[number];

// 8.71절 T-2: NEEDS_REVIEW = 자동취소 후 뒤늦은 웹훅으로 결제가 확인되어 관리자 검토가 필요한 상태
export const ORDER_STATUS = ["PENDING", "PAID", "CANCELLED", "REFUNDED", "NEEDS_REVIEW"] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const COUPON_TYPE = ["FIXED", "PERCENT"] as const;
export type CouponType = (typeof COUPON_TYPE)[number];

export const INQUIRY_STATUS = ["OPEN", "ANSWERED", "CLOSED"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUS)[number];

export const POINT_TX_TYPE = ["EARN", "USE"] as const;
export type PointTxType = (typeof POINT_TX_TYPE)[number];

export const NOTIFICATION_CHANNEL = ["EMAIL", "SMS", "PUSH"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNEL)[number];

// 8.72절 U-3: CANCELLED = "다시 받기"로 새 토큰이 발급되어 취소된 발송 — 실패가 아님(8.74절 W-3)
export const NOTIFICATION_STATUS = ["PENDING", "SENT", "FAILED", "CANCELLED"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUS)[number];

export const ADMIN_INVITATION_STATUS = ["PENDING", "ACCEPTED", "EXPIRED"] as const;
export type AdminInvitationStatus = (typeof ADMIN_INVITATION_STATUS)[number];

export const TEXT_EXTRACTION_STATUS = ["PENDING", "DONE", "FAILED"] as const;
export type TextExtractionStatus = (typeof TEXT_EXTRACTION_STATUS)[number];
