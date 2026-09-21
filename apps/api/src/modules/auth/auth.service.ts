import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomBytes, createHash } from "node:crypto";
import type { Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { OutboxService } from "../notifications/outbox.service";
import { TokensService } from "./tokens.service";
import { MfaService } from "./mfa.service";
import type { SignupInput, LoginInput, ResetPasswordInput } from "@cb-mall/shared-types";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // FR-1.6: 24시간
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000; // 8.7절: 30분

function rawAndHash(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: createHash("sha256").update(raw).digest("hex") };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tokens: TokensService,
    private readonly mfa: MfaService,
    private readonly outbox: OutboxService,
  ) {}

  async signup(input: SignupInput) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException("EMAIL_ALREADY_REGISTERED");

    const passwordHash = await argon2.hash(input.password);
    const user = await this.prisma.user.create({
      data: { email: input.email, passwordHash, name: input.name, phone: input.phone },
    });

    await this.sendVerificationEmail(user.id, user.email);
    return { id: user.id, email: user.email };
  }

  async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const { raw, hash } = rawAndHash();
    await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS) },
    });
    await this.outbox.enqueue({
      channel: "EMAIL",
      recipientRef: email,
      template: "email_verification",
      payload: { tokenRaw: raw }, // 8.58절 G-5: 해시만 저장하므로 원문은 발송을 위해 부득이하게 전달
      provider: "resend",
    }); // OutboxService가 커밋 직후 즉시 발송 이벤트를 스스로 발행한다(8.58절 G-2).
  }

  async verifyEmail(tokenRaw: string): Promise<void> {
    const hash = createHash("sha256").update(tokenRaw).digest("hex");
    const row = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash: hash } });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new BadRequestException("INVALID_OR_EXPIRED_TOKEN");
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
    ]);
  }

  async login(input: LoginInput, res: Response) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // 사용자 열거(enumeration) 방지: 존재하지 않음/비밀번호 불일치를 구분하지 않는다.
    const valid = user && (await argon2.verify(user.passwordHash, input.password).catch(() => false));
    if (!user || !valid) throw new UnauthorizedException("INVALID_CREDENTIALS");
    if (!user.isActive) throw new UnauthorizedException("ACCOUNT_DEACTIVATED");

    if (user.mfaEnabled) {
      const mfaPendingToken = this.jwt.sign({ sub: user.id, purpose: "mfa" }, { expiresIn: "5m" });
      return { mfaRequired: true, mfaPendingToken };
    }

    return this.issueSession(user, res);
  }

  async verifyMfaAndLogin(mfaPendingToken: string, code: string, res: Response) {
    const claims = this.verifyMfaPendingToken(mfaPendingToken);
    const ok = await this.mfa.verifyCode(claims.sub, code);
    if (!ok) throw new UnauthorizedException("INVALID_MFA_CODE");
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: claims.sub } });
    return this.issueSession(user, res);
  }

  async verifyMfaRecoveryAndLogin(mfaPendingToken: string, recoveryCode: string, res: Response) {
    const claims = this.verifyMfaPendingToken(mfaPendingToken);
    const ok = await this.mfa.verifyRecoveryCode(claims.sub, recoveryCode);
    if (!ok) throw new UnauthorizedException("INVALID_RECOVERY_CODE");
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: claims.sub } });
    return this.issueSession(user, res);
  }

  private verifyMfaPendingToken(token: string): { sub: string } {
    try {
      const claims = this.jwt.verify<{ sub: string; purpose: string }>(token);
      if (claims.purpose !== "mfa") throw new Error("wrong purpose");
      return claims;
    } catch {
      throw new UnauthorizedException("INVALID_MFA_PENDING_TOKEN");
    }
  }

  private async issueSession(user: { id: string; email: string; role: string }, res: Response) {
    const pair = await this.tokens.issueTokenPair(user as never);
    this.tokens.setRefreshCookie(res, pair.refreshTokenRaw);
    return { accessToken: pair.accessToken };
  }

  async refresh(refreshTokenRaw: string, res: Response) {
    if (!refreshTokenRaw) throw new UnauthorizedException("NO_REFRESH_TOKEN");
    const pair = await this.tokens.rotateRefreshToken(refreshTokenRaw);
    if (pair.refreshTokenRaw) this.tokens.setRefreshCookie(res, pair.refreshTokenRaw); // 8.53절: 경쟁 재사용 시 쿠키 재설정 생략
    return { accessToken: pair.accessToken };
  }

  // 8.53절 방안 B: Server Component가 쿠키를 "읽기만" 해서 호출하는 비회전 SSR 전용 엔드포인트.
  async ssrToken(refreshTokenRaw: string): Promise<{ accessToken: string }> {
    const accessToken = await this.tokens.issueSsrAccessToken(refreshTokenRaw);
    return { accessToken };
  }

  async logout(refreshTokenRaw: string | undefined, res: Response): Promise<void> {
    if (refreshTokenRaw) await this.tokens.revokeOne(refreshTokenRaw);
    this.tokens.clearRefreshCookie(res);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return; // 사용자 열거 방지: 존재 여부와 무관하게 동일 응답
    const { raw, hash } = rawAndHash();
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS) },
    });
    await this.outbox.enqueue({
      channel: "EMAIL",
      recipientRef: email,
      template: "password_reset",
      payload: { tokenRaw: raw },
      provider: "resend",
    });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const hash = createHash("sha256").update(input.token).digest("hex");
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: hash } });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new BadRequestException("INVALID_OR_EXPIRED_TOKEN");

    const passwordHash = await argon2.hash(input.newPassword);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    ]);
    // 비밀번호가 바뀌었으므로 기존 세션은 전부 무효화한다.
    await this.tokens.revokeAllForUser(row.userId);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
      emailVerified: !!user.emailVerifiedAt,
      pointBalance: user.pointBalance,
    };
  }
}
