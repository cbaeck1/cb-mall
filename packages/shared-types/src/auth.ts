import { z } from "zod";

// PRD 8.7절: 비밀번호 정책 — 최소 10자, 영문+숫자+특수문자 중 2종 이상 조합(과도한 복잡도 규칙 지양)
export const passwordSchema = z
  .string()
  .min(10, "비밀번호는 10자 이상이어야 합니다")
  .max(128)
  .refine((v) => {
    const kinds = [/[a-zA-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(v)).length;
    return kinds >= 2;
  }, "영문/숫자/특수문자 중 2종 이상을 조합해야 합니다");

export const emailSchema = z.string().trim().toLowerCase().email("올바른 이메일 형식이 아닙니다");

// FR-1.1
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(50).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^01[0-9]-?\d{3,4}-?\d{4}$/, "휴대폰 번호 형식이 올바르지 않습니다")
    .optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

// FR-1.2
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const mfaLoginVerifySchema = z.object({
  mfaPendingToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, "6자리 숫자를 입력하세요"),
});
export type MfaLoginVerifyInput = z.infer<typeof mfaLoginVerifySchema>;

export const mfaRecoveryVerifySchema = z.object({
  mfaPendingToken: z.string().min(1),
  recoveryCode: z.string().min(1),
});
export type MfaRecoveryVerifyInput = z.infer<typeof mfaRecoveryVerifySchema>;

// FR-1.1 비밀번호 재설정 — 8.7절: 1회용 시간제한(30분) 토큰
export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// FR-1.6 이메일 인증
export const verifyEmailSchema = z.object({ token: z.string().min(1) });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// 8.19절 MFA 등록
export const mfaEnableVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});
export type MfaEnableVerifyInput = z.infer<typeof mfaEnableVerifySchema>;

// 8.20절 관리자 초대 수락
export const acceptAdminInvitationSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1).max(50),
  password: passwordSchema,
});
export type AcceptAdminInvitationInput = z.infer<typeof acceptAdminInvitationSchema>;

export const inviteAdminSchema = z.object({
  email: emailSchema,
  role: z.enum(["ADMIN", "SUPER_ADMIN"]),
});
export type InviteAdminInput = z.infer<typeof inviteAdminSchema>;
