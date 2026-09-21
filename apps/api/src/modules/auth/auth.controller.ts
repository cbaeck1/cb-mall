import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimit } from "../../common/rate-limit/rate-limit.decorator";
import { PostgresRateLimitGuard } from "../../common/rate-limit/rate-limit.guard";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { AuthService } from "./auth.service";
import { TokensService } from "./tokens.service";
import {
  SignupDto,
  LoginDto,
  MfaLoginVerifyDto,
  MfaRecoveryVerifyDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from "./dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post("signup")
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Public()
  @Post("verify-email")
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token).then(() => ({ ok: true }));
  }

  @Public()
  @UseGuards(PostgresRateLimitGuard)
  @RateLimit({ limit: 5, windowSeconds: 60, keyBy: "email" }) // 8.7/8.11절
  @Post("login")
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto, res);
  }

  @Public()
  @Post("mfa/login-verify")
  @HttpCode(200)
  mfaLoginVerify(@Body() dto: MfaLoginVerifyDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.verifyMfaAndLogin(dto.mfaPendingToken, dto.code, res);
  }

  @Public()
  @Post("mfa/login-verify-recovery")
  @HttpCode(200)
  mfaLoginVerifyRecovery(@Body() dto: MfaRecoveryVerifyDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.verifyMfaRecoveryAndLogin(dto.mfaPendingToken, dto.recoveryCode, res);
  }

  // 8.7절: 브라우저가 직접 호출(BFF 경유 없음, 8.66절 O-1). httpOnly 쿠키를 credentials:'include'로 전송.
  @Public()
  @Post("refresh")
  @HttpCode(200)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[this.tokens.getRefreshCookieName()];
    return this.auth.refresh(raw, res);
  }

  // 8.53절 방안 B: Next.js 서버(SSR 헬퍼 함수)만 호출 가능. 회전하지 않는다.
  @Public()
  @Post("ssr-token")
  @HttpCode(200)
  ssrToken(
    @Headers("x-ssr-relay-secret") secret: string | undefined,
    @Body("refreshToken") refreshToken: string,
  ) {
    if (secret !== this.config.get<string>("SSR_RELAY_SHARED_SECRET")) {
      throw new ForbiddenException("INVALID_RELAY_SECRET");
    }
    return this.auth.ssrToken(refreshToken);
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[this.tokens.getRefreshCookieName()];
    return this.auth.logout(raw, res).then(() => ({ ok: true }));
  }

  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  @Public()
  @UseGuards(PostgresRateLimitGuard)
  @RateLimit({ limit: 5, windowSeconds: 60, keyBy: "email" }) // 8.7/8.11절
  @Post("forgot-password")
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email).then(() => ({ ok: true }));
  }

  @Public()
  @Post("reset-password")
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto).then(() => ({ ok: true }));
  }
}
