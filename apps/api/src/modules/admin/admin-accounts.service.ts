import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { randomBytes, createHash } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { OutboxService } from "../notifications/outbox.service";
import type { InviteAdminInput, AcceptAdminInvitationInput } from "@cb-mall/shared-types";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

// PRD 8.20절: 관리자 계정은 초대 기반 생성만 허용(셀프 가입 없음). SUPER_ADMIN/ADMIN 2단계 권한.
// 8.20절 잠김(lockout) 방지: 마지막 남은 활성 SUPER_ADMIN은 비활성화/강등할 수 없다.
@Injectable()
export class AdminAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async invite(inviterId: string, input: InviteAdminInput): Promise<{ id: string }> {
    const raw = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(raw).digest("hex");
    const invitation = await this.prisma.adminInvitation.create({
      data: {
        email: input.email,
        role: input.role,
        tokenHash: hash,
        invitedById: inviterId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    });

    await this.outbox.enqueue({
      channel: "EMAIL",
      recipientRef: input.email,
      template: "admin_invitation",
      payload: { tokenRaw: raw }, // 원문 필요(초대 링크에 포함) — 발송 후 정리 대상(8.58절 G-5)
      provider: "resend",
    });
    return { id: invitation.id };
  }

  async accept(input: AcceptAdminInvitationInput) {
    const hash = createHash("sha256").update(input.token).digest("hex");
    const invitation = await this.prisma.adminInvitation.findUnique({ where: { tokenHash: hash } });
    if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
      throw new BadRequestException("INVALID_OR_EXPIRED_INVITATION");
    }

    const existing = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) throw new ConflictException("EMAIL_ALREADY_REGISTERED");

    const passwordHash = await argon2.hash(input.password);
    const [user] = await this.prisma.$transaction([
      this.prisma.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          name: input.name,
          role: invitation.role,
          emailVerifiedAt: new Date(), // 초대 이메일로 이미 신원이 확인됨
        },
      }),
      this.prisma.adminInvitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } }),
    ]);

    // 8.19절: 관리자는 MFA 필수 — 로그인 세션은 발급하되 프론트가 mfaSetupRequired를 보고 강제 이동시킨다.
    return { id: user.id, email: user.email, role: user.role, mfaSetupRequired: true };
  }

  async list() {
    return this.prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { id: true, email: true, name: true, role: true, isActive: true, mfaEnabled: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async listInvitations() {
    return this.prisma.adminInvitation.findMany({ orderBy: { createdAt: "desc" } });
  }

  async deactivate(targetId: string): Promise<void> {
    await this.assertNotLastActiveSuperAdmin(targetId);
    await this.prisma.user.update({ where: { id: targetId }, data: { isActive: false, deactivatedAt: new Date() } });
  }

  async changeRole(targetId: string, role: "ADMIN" | "SUPER_ADMIN"): Promise<void> {
    if (role === "ADMIN") await this.assertNotLastActiveSuperAdmin(targetId);
    await this.prisma.user.update({ where: { id: targetId }, data: { role } });
  }

  private async assertNotLastActiveSuperAdmin(targetId: string): Promise<void> {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (target?.role !== "SUPER_ADMIN" || !target.isActive) return;
    const activeSuperAdminCount = await this.prisma.user.count({
      where: { role: "SUPER_ADMIN", isActive: true },
    });
    if (activeSuperAdminCount <= 1) {
      throw new ConflictException("CANNOT_REMOVE_LAST_ACTIVE_SUPER_ADMIN");
    }
  }
}
