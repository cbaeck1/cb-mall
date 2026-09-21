import type { PrismaService } from "../../prisma/prisma.service";
import type { S3Client } from "@aws-sdk/client-s3";
import { presignPrivateDownload } from "../../common/aws/s3-presign.util";

export interface RenderResult {
  email?: { subject: string; html: string };
  sms?: { text: string };
  push?: { title: string; body: string };
  skip?: boolean; // 8.72절 U-2: 발송 직전 유효성 확인 실패(토큰 만료 등) → 발송하지 않고 FAILED 처리
  skipReason?: string;
}

export interface TemplateContext {
  prisma: PrismaService;
  frontendOrigin: string;
  s3: S3Client;
  privateBucket: string;
}

// PRD 8.58절 G-5: payload에는 식별자(또는 부득이한 경우 원문 토큰)만 저장하고, 실제 링크·본문은
// 발송 시점에 이 함수에서 조립한다. 8.72절 U-2: 여기서 유효성을 확인해 만료된 링크 발송을 막는다.
export async function renderTemplate(
  ctx: TemplateContext,
  template: string,
  payload: Record<string, unknown>,
): Promise<RenderResult> {
  switch (template) {
    case "password_reset": {
      const tokenRaw = payload.tokenRaw as string;
      const { createHash } = await import("node:crypto");
      const row = await ctx.prisma.passwordResetToken.findUnique({
        where: { tokenHash: createHash("sha256").update(tokenRaw).digest("hex") },
      });
      if (!row || row.usedAt || row.expiresAt < new Date()) {
        return { skip: true, skipReason: "token_expired" }; // 8.72절 U-2
      }
      const link = `${ctx.frontendOrigin}/reset-password?token=${tokenRaw}`;
      return {
        email: {
          subject: "[cb몰] 비밀번호 재설정 안내",
          html: `<p>아래 링크에서 비밀번호를 재설정해 주세요. 이 링크는 30분간 유효합니다.</p><p><a href="${link}">${link}</a></p>`,
        },
      };
    }

    case "email_verification": {
      const tokenRaw = payload.tokenRaw as string;
      const { createHash } = await import("node:crypto");
      const row = await ctx.prisma.emailVerificationToken.findUnique({
        where: { tokenHash: createHash("sha256").update(tokenRaw).digest("hex") },
      });
      if (!row || row.usedAt || row.expiresAt < new Date()) {
        return { skip: true, skipReason: "token_expired" };
      }
      const link = `${ctx.frontendOrigin}/verify-email?token=${tokenRaw}`;
      return {
        email: {
          subject: "[cb몰] 이메일 인증을 완료해 주세요",
          html: `<p>아래 링크를 눌러 이메일 인증을 완료해 주세요.</p><p><a href="${link}">${link}</a></p>`,
        },
      };
    }

    case "download_link_guest": {
      const entitlementId = payload.entitlementId as string;
      const entitlement = await ctx.prisma.entitlement.findUnique({
        where: { id: entitlementId },
        include: { orderItem: { include: { product: true } } },
      });
      if (!entitlement || entitlement.expiresAt < new Date()) {
        return { skip: true, skipReason: "entitlement_expired" };
      }
      const link = `${ctx.frontendOrigin}/guest-download/${entitlement.accessToken}`; // capability 토큰(평문 저장, entitlements.access_token)
      return {
        email: {
          subject: `[cb몰] ${entitlement.orderItem.product.title} 다운로드 안내`,
          html: `<p>구매하신 전자책을 아래 링크에서 다운로드하세요.</p><p><a href="${link}">${link}</a></p>`,
        },
      };
    }

    // 8.71절 T-2: 자동취소 후 뒤늦은 웹훅으로 결제가 확인되어 관리자 검토가 필요한 주문(긴급)
    case "order_needs_review": {
      const orderId = payload.orderId as string;
      return {
        email: {
          subject: "[cb몰 관리자] 검토가 필요한 주문이 있습니다",
          html: `<p>자동취소된 주문에 뒤늦게 결제가 확인되었습니다. 관리자 검토가 필요합니다.</p><p><a href="${ctx.frontendOrigin}/admin/orders/${orderId}">주문 확인하기</a></p>`,
        },
      };
    }

    // 8.20절: 관리자 초대
    case "admin_invitation": {
      const tokenRaw = payload.tokenRaw as string;
      const { createHash } = await import("node:crypto");
      const row = await ctx.prisma.adminInvitation.findUnique({
        where: { tokenHash: createHash("sha256").update(tokenRaw).digest("hex") },
      });
      if (!row || row.status !== "PENDING" || row.expiresAt < new Date()) {
        return { skip: true, skipReason: "invitation_expired_or_used" };
      }
      const link = `${ctx.frontendOrigin}/admin/accept-invitation?token=${tokenRaw}`;
      return {
        email: {
          subject: "[cb몰] 관리자 계정 초대",
          html: `<p>cb몰 관리자로 초대되었습니다. 아래 링크에서 계정을 설정해 주세요(7일 이내).</p><p><a href="${link}">${link}</a></p>`,
        },
      };
    }

    case "order_confirmation": {
      const orderId = payload.orderId as string;
      const order = await ctx.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) return { skip: true, skipReason: "order_not_found" };
      return {
        email: {
          subject: "[cb몰] 주문이 완료되었습니다",
          html: `<p>주문이 정상적으로 완료되었습니다. 마이페이지에서 다운로드하실 수 있습니다.</p><p><a href="${ctx.frontendOrigin}/mypage/orders/${order.id}">주문 상세 보기</a></p>`,
        },
      };
    }

    // 8.75절: 개정판 발행 — 본문에 책 제목은 넣되(이메일은 잠금화면 노출 위험이 없음), 푸시는 P3에 따라 제목 생략
    case "revision_published": {
      const entitlementId = payload.entitlementId as string;
      const entitlement = await ctx.prisma.entitlement.findUnique({
        where: { id: entitlementId },
        include: { orderItem: { include: { product: true } } },
      });
      if (!entitlement) return { skip: true, skipReason: "entitlement_not_found" };
      return {
        email: {
          subject: `[cb몰] ${entitlement.orderItem.product.title} 개정판(오탈자 수정본) 안내`,
          html: `<p>구매하신 도서의 오탈자 수정본이 등록되었습니다. 다운로드 한도가 1회 추가로 부여되었습니다.</p><p><a href="${ctx.frontendOrigin}/mypage/downloads">마이페이지에서 다운로드</a></p>`,
        },
        push: { title: "cb몰", body: "구매하신 도서의 개정판이 나왔습니다. 앱에서 확인해 보세요." }, // 8.75절 P3
      };
    }

    // FR-5.2 / 8.75절
    case "inquiry_answered": {
      const inquiryId = payload.inquiryId as string;
      const inquiry = await ctx.prisma.inquiry.findUnique({ where: { id: inquiryId } });
      if (!inquiry) return { skip: true, skipReason: "inquiry_not_found" };
      return {
        email: {
          subject: "[cb몰] 문의하신 내용에 답변이 등록되었습니다",
          html: `<p>"${inquiry.subject}" 문의에 답변이 등록되었습니다.</p><p><a href="${ctx.frontendOrigin}/mypage/inquiries/${inquiryId}">답변 확인하기</a></p>`,
        },
        push: { title: "cb몰", body: "문의하신 내용에 답변이 등록되었습니다." },
      };
    }

    // FR-4.6 / 8.75절
    case "entitlement_expiring": {
      const entitlementId = payload.entitlementId as string;
      const entitlement = await ctx.prisma.entitlement.findUnique({
        where: { id: entitlementId },
        include: { orderItem: { include: { product: true } } },
      });
      if (!entitlement) return { skip: true, skipReason: "entitlement_not_found" };
      return {
        email: {
          subject: `[cb몰] ${entitlement.orderItem.product.title} 다운로드 기간이 곧 만료됩니다`,
          html: `<p>구매하신 도서의 다운로드 가능 기간이 30일 후 만료됩니다. 만료 전에 다운로드해 주세요.</p><p><a href="${ctx.frontendOrigin}/mypage/downloads">마이페이지에서 다운로드</a></p>`,
        },
        push: { title: "cb몰", body: "구매하신 도서의 다운로드 기간이 곧 만료됩니다." }, // 8.75절 P3
      };
    }

    default:
      return { skip: true, skipReason: "unknown_template" };
  }
}

// 8.73절 V-1: URL 유효기간 5분. entitlements 모듈과 동일한 유틸을 재사용한다.
export async function presignDownloadUrl(ctx: TemplateContext, fileKey: string, fileName: string): Promise<string> {
  return presignPrivateDownload(ctx.s3, ctx.privateBucket, fileKey, fileName);
}
