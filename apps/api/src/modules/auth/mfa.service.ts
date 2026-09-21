import { BadRequestException, Injectable } from "@nestjs/common";
import { authenticator } from "otplib";
import * as QRCode from "qrcode";
import { randomBytes, createHash } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { KmsEncryptionService } from "../../common/crypto/kms-encryption.service";

// PRD 8.19절: TOTP 기반 MFA. 관리자는 필수, 일반 회원은 선택. secret은 KMS 봉투암호화 저장.
@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kms: KmsEncryptionService,
  ) {}

  async beginSetup(userId: string, email: string): Promise<{ secret: string; qrDataUrl: string }> {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(email, "cb몰", secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    const enc = await this.kms.encrypt(secret);
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecretEnc: enc } });
    return { secret, qrDataUrl };
  }

  async verifyAndEnable(userId: string, code: string): Promise<string[]> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecretEnc) throw new BadRequestException("MFA_SETUP_NOT_STARTED");
    const secret = await this.kms.decrypt(user.mfaSecretEnc);
    if (!authenticator.check(code, secret)) throw new BadRequestException("INVALID_MFA_CODE");

    const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(5).toString("hex"));
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } }),
      this.prisma.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((c) => ({ userId, codeHash: createHash("sha256").update(c).digest("hex") })),
      }),
    ]);
    return recoveryCodes; // 사용자에게 1회 노출, 서버는 해시만 보관
  }

  async verifyCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecretEnc) return false;
    const secret = await this.kms.decrypt(user.mfaSecretEnc);
    return authenticator.check(code, secret);
  }

  async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    const hash = createHash("sha256").update(code).digest("hex");
    const row = await this.prisma.mfaRecoveryCode.findFirst({ where: { userId, codeHash: hash, usedAt: null } });
    if (!row) return false;
    await this.prisma.mfaRecoveryCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    return true;
  }

  // 8.19절: 관리자 잠김(lockout) 방지 — 마지막 활성 SUPER_ADMIN의 MFA 비활성화는 별도 검증 필요(admin-accounts 모듈에서 확인)
  async disable(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecretEnc: null } }),
      this.prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
    ]);
  }
}
