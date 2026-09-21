import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KMSClient, EncryptCommand, DecryptCommand } from "@aws-sdk/client-kms";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// PRD 8.19/8.30절: MFA secret은 단방향 해시가 불가하므로 AWS KMS 봉투암호화로 저장한다.
// 8.30절 키 로테이션 정책의 대상이 되는 자리다.
//
// 로컬 개발/CI에서는 실제 KMS 키가 없으므로(사용자 요청: 외부 서비스 연동은 구축 완료 후 일괄 처리),
// KMS_KEY_ID가 비어 있으면 로컬 전용 AES-256-GCM으로 대체한다. 이 대체 경로는 운영에서 반드시
// KMS_KEY_ID를 설정해 비활성화해야 한다 — 아래 assertProductionSafe()가 부팅 시 이를 강제한다.
@Injectable()
export class KmsEncryptionService {
  private readonly logger = new Logger(KmsEncryptionService.name);
  private readonly kms: KMSClient | null;
  private readonly keyId?: string;
  private readonly devKey: Buffer;

  constructor(private readonly config: ConfigService) {
    this.keyId = this.config.get<string>("KMS_KEY_ID") || undefined;
    this.kms = this.keyId ? new KMSClient({ region: this.config.get("AWS_REGION") }) : null;
    // 로컬 전용 폴백 키 — JWT_ACCESS_SECRET에서 파생(운영에서는 사용되지 않음)
    this.devKey = scryptSync(this.config.get<string>("JWT_ACCESS_SECRET")!, "cbmall-mfa-dev-salt", 32);

    if (!this.kms) {
      this.logger.warn(
        "KMS_KEY_ID가 설정되지 않아 로컬 전용 암호화로 대체합니다. 운영 배포 전 반드시 KMS_KEY_ID를 설정하세요 (PRD 8.19/8.30절).",
      );
    }
  }

  assertProductionSafe(nodeEnv: string) {
    if (nodeEnv === "production" && !this.kms) {
      throw new Error("운영 환경에서는 KMS_KEY_ID가 반드시 설정되어야 합니다 (PRD 8.19/8.30절).");
    }
  }

  async encrypt(plaintext: string): Promise<string> {
    if (this.kms && this.keyId) {
      const res = await this.kms.send(
        new EncryptCommand({ KeyId: this.keyId, Plaintext: Buffer.from(plaintext, "utf8") }),
      );
      return `kms:${Buffer.from(res.CiphertextBlob!).toString("base64")}`;
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.devKey, iv);
    const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `dev:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
  }

  async decrypt(ciphertext: string): Promise<string> {
    if (ciphertext.startsWith("kms:")) {
      if (!this.kms) throw new Error("KMS로 암호화된 값을 복호화하려면 KMS_KEY_ID가 필요합니다.");
      const res = await this.kms.send(
        new DecryptCommand({ CiphertextBlob: Buffer.from(ciphertext.slice(4), "base64") }),
      );
      return Buffer.from(res.Plaintext!).toString("utf8");
    }
    const [, ivB64, tagB64, dataB64] = ciphertext.split(":");
    const decipher = createDecipheriv("aes-256-gcm", this.devKey, Buffer.from(ivB64!, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64!, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64!, "base64")), decipher.final()]);
    return dec.toString("utf8");
  }
}
