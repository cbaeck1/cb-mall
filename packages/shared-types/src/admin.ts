import { z } from "zod";

// FR-7.10: 네트워크 실패 등으로 실제 수신 없이 횟수만 차감된 고객의 다운로드 한도 재부여
export const grantDownloadLimitSchema = z.object({
  entitlementId: z.string().uuid(),
  additionalDownloads: z.number().int().positive().max(10).default(1),
  reason: z.string().trim().min(1).max(500),
});
export type GrantDownloadLimitInput = z.infer<typeof grantDownloadLimitSchema>;

// FR-7.4 회원 관리(등급/제재)
export const memberSanctionSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});
export type MemberSanctionInput = z.infer<typeof memberSanctionSchema>;

// FR-7.7 알림 수동 재발송 — 대상은 FAILED만(8.74절 W-3: CANCELLED는 정상 종료라 제외)
export const resendNotificationSchema = z.object({
  outboxId: z.string().uuid(),
});
export type ResendNotificationInput = z.infer<typeof resendNotificationSchema>;

// FR-7.3 NEEDS_REVIEW 처리(8.71절 T-2) — 수동 환불 또는 주문 복구 중 하나를 선택, 감사 로그에 기록(FR-7.9)
export const resolveNeedsReviewSchema = z.object({
  resolution: z.enum(["REFUND", "RESTORE"]),
  note: z.string().trim().min(1).max(1000),
});
export type ResolveNeedsReviewInput = z.infer<typeof resolveNeedsReviewSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
