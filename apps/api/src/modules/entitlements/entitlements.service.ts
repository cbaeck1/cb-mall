import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import { S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { OutboxService } from "../notifications/outbox.service";
import { presignPrivateDownload } from "../../common/aws/s3-presign.util";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000; // FR-4.2

interface DownloadCountRow {
  id: string;
  download_count: number;
  max_downloads: number;
  expires_at: Date;
}

// PRD FR-4.1~4.5, 8.4/8.10/8.11/8.73/8.74절: 원자적 다운로드 카운트(increment_download_count) +
// 5분 presigned URL. 8.73절 V-2/8.74절 W-1이 반영된 raw SQL 함수를 그대로 호출한다.
@Injectable()
export class EntitlementsService {
  private readonly s3: S3Client;
  private readonly privateBucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
  ) {
    this.s3 = new S3Client({ region: this.config.get("AWS_REGION") });
    this.privateBucket = this.config.get<string>("S3_PRIVATE_BUCKET")!;
  }

  // 8.8절 결제 확정 시 호출 — 주문의 각 아이템에 대해 엔타이틀먼트 생성(멱등: 이미 있으면 건너뜀)
  async createForOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { entitlement: true } } },
    });
    const expiresAt = new Date(Date.now() + ONE_YEAR_MS);

    for (const item of order.items) {
      if (item.entitlement) continue; // 웹훅 재시도 등으로 중복 호출되어도 안전(8.71절 T-1 멱등 완결)
      await this.prisma.entitlement.create({
        data: {
          orderItemId: item.id,
          userId: order.userId,
          guestEmail: order.guestEmail,
          accessToken: randomUUID(),
          expiresAt,
        },
      });
    }
  }

  async download(entitlementId: string, requester: { userId?: string; guestEmail?: string }, ip?: string, ua?: string) {
    const entitlement = await this.prisma.entitlement.findUnique({
      where: { id: entitlementId },
      include: { orderItem: { include: { product: true } } },
    });
    if (!entitlement) throw new NotFoundException("ENTITLEMENT_NOT_FOUND");
    this.assertOwnership(entitlement, requester);

    return this.issueDownload(entitlement.id, entitlement.orderItem.product.pdfFileKey, entitlement.orderItem.product.title, ip, ua);
  }

  // FR-4.3: 비회원은 이메일 일회성 링크(capability 토큰)로 접근
  async guestDownload(accessToken: string, ip?: string, ua?: string) {
    const entitlement = await this.prisma.entitlement.findUnique({
      where: { accessToken },
      include: { orderItem: { include: { product: true } } },
    });
    if (!entitlement) throw new NotFoundException("ENTITLEMENT_NOT_FOUND");
    return this.issueDownload(entitlement.id, entitlement.orderItem.product.pdfFileKey, entitlement.orderItem.product.title, ip, ua);
  }

  private assertOwnership(entitlement: { userId: string | null }, requester: { userId?: string }): void {
    if (entitlement.userId && entitlement.userId !== requester.userId) {
      throw new ForbiddenException("NOT_YOUR_ENTITLEMENT");
    }
  }

  // 8.73절 V-1~V-3, 8.74절 W-1: 원자적 카운트 + 재사용 창 + 이원화 속도 제한(전부 raw SQL 함수 안에서 처리)
  private async issueDownload(entitlementId: string, fileKey: string, title: string, ip?: string, ua?: string) {
    let rows: DownloadCountRow[];
    try {
      rows = await this.prisma.$queryRaw<DownloadCountRow[]>`
        SELECT * FROM increment_download_count(${entitlementId}::uuid, ${ip ?? null}, ${ua ?? null}, 5);
      `;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("DOWNLOAD_RATE_LIMITED")) throw new BadRequestException("DOWNLOAD_RATE_LIMITED");
      if (message.includes("DOWNLOAD_LIMIT_EXCEEDED_OR_EXPIRED")) throw new BadRequestException("DOWNLOAD_LIMIT_EXCEEDED_OR_EXPIRED");
      throw err;
    }

    await this.prisma.entitlement.updateMany({
      where: { id: entitlementId, firstClickedAt: null },
      data: { firstClickedAt: new Date() }, // FR-3.5 환불 판정 기준
    });

    const row = rows[0]!;
    const downloadUrl = await presignPrivateDownload(this.s3, this.privateBucket, fileKey, `${title}.pdf`);
    return {
      downloadUrl,
      remainingDownloads: Math.max(0, row.max_downloads - row.download_count),
      expiresAt: row.expires_at,
    };
  }

  listForUser(userId: string) {
    return this.prisma.entitlement.findMany({
      where: { userId },
      include: { orderItem: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  // FR-7.10: 네트워크 실패 등으로 실제 수신 없이 횟수만 차감된 고객의 한도 재부여(관리자)
  async grantAdditional(entitlementId: string, additional: number): Promise<void> {
    await this.prisma.entitlement.update({
      where: { id: entitlementId },
      data: { maxDownloads: { increment: additional } },
    });
  }

  // 8.75절/8.73절 V-4: 오탈자 수정본 발행 시 기존 구매자에게 한도 +1 부여 + 알림(이메일+푸시 쌍)
  // 8.21절: ProductsModule과의 결합을 피하기 위해 이벤트로 반응한다(부작용은 이벤트로).
  @OnEvent("product.revision.errata_published")
  async handleErrataPublished(payload: { productId: string }): Promise<void> {
    const { productId } = payload;
    const entitlements = await this.prisma.entitlement.findMany({
      where: {
        orderItem: { productId },
        expiresAt: { gt: new Date() }, // 8.75절: 유효한 엔타이틀먼트 보유자만
      },
      include: { user: { include: { pushSubscriptions: true } } },
    });

    for (const e of entitlements) {
      await this.prisma.entitlement.update({ where: { id: e.id }, data: { maxDownloads: { increment: 1 } } });
      const email = e.user?.email ?? e.guestEmail;
      if (!email) continue;
      await this.outbox.enqueueEmailWithOptionalPush({
        email,
        fcmTokens: e.user?.pushSubscriptions.map((p) => p.fcmToken) ?? [],
        template: "revision_published",
        payload: { entitlementId: e.id },
      });
    }
  }
}
