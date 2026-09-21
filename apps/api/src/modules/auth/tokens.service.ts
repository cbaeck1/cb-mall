import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomBytes, createHash } from "node:crypto";
import type { Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import type { Role } from "@cb-mall/shared-types";

// PRD 8.7/8.53절: Access(15~30분, 응답 바디로만 전달) + Refresh(httpOnly 쿠키, 30일, 회전+재사용 탐지).
// 8.53절 추가 검증: 브라우저 동시 refresh(여러 탭이 401을 동시에 받아 각자 refresh)에서 오탐이 나지
// 않도록 회전 유예 30초를 둔다 — 이미 회전된 토큰이 유예 안에 다시 제시되면 "재사용"이 아니라
// "경쟁"으로 보고 같은 신규 토큰을 그대로 재발급한다.
const REUSE_GRACE_MS = 30_000;
const REFRESH_TOKEN_BYTES = 32;

export interface IssuedTokenPair {
  accessToken: string;
  refreshTokenRaw: string;
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  signAccessToken(user: { id: string; email: string; role: Role }): string {
    return this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: this.config.get<string>("JWT_ACCESS_TTL") },
    );
  }

  // 8.53절 방안 B: SSR 전용, 회전하지 않고 검증만 하는 단명 Access Token 발급.
  // 호출자는 반드시 서버 간 공유 시크릿(SSR_RELAY_SHARED_SECRET)을 제시해야 한다.
  async issueSsrAccessToken(refreshTokenRaw: string): Promise<string> {
    const hash = hashToken(refreshTokenRaw);
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash }, include: { user: true } });
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      throw new UnauthorizedException("INVALID_REFRESH_TOKEN");
    }
    // 짧은 TTL(1분)로 발급 — SSR 렌더 한 번에만 쓰이고 폐기된다.
    return this.jwt.sign(
      { sub: row.user.id, email: row.user.email, role: row.user.role },
      { expiresIn: "60s" },
    );
  }

  async issueTokenPair(user: { id: string; email: string; role: Role }): Promise<IssuedTokenPair> {
    const accessToken = this.signAccessToken(user);
    const refreshTokenRaw = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
    const ttlDays = this.config.get<number>("JWT_REFRESH_TTL_DAYS")!;
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshTokenRaw),
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, refreshTokenRaw };
  }

  // 브라우저 직접 호출 경로의 회전. 재사용 탐지 시 해당 사용자의 전체 세션을 강제 로그아웃한다.
  async rotateRefreshToken(refreshTokenRaw: string): Promise<IssuedTokenPair> {
    const hash = hashToken(refreshTokenRaw);
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash }, include: { user: true } });

    if (!row || row.expiresAt < new Date()) {
      throw new UnauthorizedException("INVALID_REFRESH_TOKEN");
    }

    if (row.revokedAt) {
      const alreadyReplaced = row.replacedById
        ? await this.prisma.refreshToken.findUnique({ where: { id: row.replacedById } })
        : null;

      const withinGrace = Date.now() - row.revokedAt.getTime() < REUSE_GRACE_MS;
      if (withinGrace && alreadyReplaced && !alreadyReplaced.revokedAt) {
        // 동시 요청 경쟁: 이미 발급된 다음 세대 토큰을 그대로 돌려준다(재사용 탐지 오탐 방지, 8.53절).
        return {
          accessToken: this.signAccessToken(row.user),
          refreshTokenRaw: "", // 주의: 원문은 1회만 존재하므로 재사용 시에는 새 쿠키를 다시 세팅하지 않는다.
        };
      }

      // 유예를 벗어난 재사용 → 침해 의심. 해당 사용자의 모든 활성 Refresh Token을 폐기한다.
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("REFRESH_TOKEN_REUSE_DETECTED");
    }

    const next = await this.issueTokenPair(row.user);
    const nextRow = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(next.refreshTokenRaw) } });
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date(), replacedById: nextRow!.id },
    });

    return next;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeOne(refreshTokenRaw: string): Promise<void> {
    await this.prisma.refreshToken
      .update({ where: { tokenHash: hashToken(refreshTokenRaw) }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }

  // 8.7/8.65절: Domain 속성은 SSR 릴레이가 app. 도메인에서 쿠키를 읽어야 하므로 필요하다(8.65절 N-2).
  // Domain과 함께 쓸 수 없어 __Host- 대신 __Secure- 접두사를 사용한다.
  setRefreshCookie(res: Response, raw: string): void {
    const domain = this.config.get<string>("REFRESH_COOKIE_DOMAIN") || undefined;
    const isProd = this.config.get<string>("NODE_ENV") === "production";
    const ttlDays = this.config.get<number>("JWT_REFRESH_TTL_DAYS")!;
    res.cookie(isProd ? "__Secure-refresh_token" : "refresh_token", raw, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      domain,
      path: "/", // 8.51절 C-2: Path 제한 제거(8.53절에서 비회전 SSR 엔드포인트로 근본 해결)
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
    });
  }

  clearRefreshCookie(res: Response): void {
    const domain = this.config.get<string>("REFRESH_COOKIE_DOMAIN") || undefined;
    const isProd = this.config.get<string>("NODE_ENV") === "production";
    res.clearCookie(isProd ? "__Secure-refresh_token" : "refresh_token", { domain, path: "/" });
  }

  getRefreshCookieName(): string {
    return this.config.get<string>("NODE_ENV") === "production" ? "__Secure-refresh_token" : "refresh_token";
  }
}
