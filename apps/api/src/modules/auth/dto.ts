import { createZodDto } from "nestjs-zod";
import {
  signupSchema,
  loginSchema,
  mfaLoginVerifySchema,
  mfaRecoveryVerifySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  mfaEnableVerifySchema,
} from "@cb-mall/shared-types";

export class SignupDto extends createZodDto(signupSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class MfaLoginVerifyDto extends createZodDto(mfaLoginVerifySchema) {}
export class MfaRecoveryVerifyDto extends createZodDto(mfaRecoveryVerifySchema) {}
export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}
export class MfaEnableVerifyDto extends createZodDto(mfaEnableVerifySchema) {}
