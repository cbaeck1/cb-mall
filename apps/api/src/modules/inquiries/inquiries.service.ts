import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { OutboxService } from "../notifications/outbox.service";
import type { InquiryCreateInput, InquiryAnswerInput, ProductQnaCreateInput } from "@cb-mall/shared-types";

// FR-5.2 1:1 문의, FR-5.3 상품 Q&A, 8.75절: 답변 등록 시 이메일+푸시 알림(거래 정보성 3건 중 하나)
@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  create(requester: { userId?: string; guestEmail?: string }, input: InquiryCreateInput) {
    return this.prisma.inquiry.create({
      data: { userId: requester.userId, guestEmail: requester.guestEmail, subject: input.subject, content: input.content },
    });
  }

  listMine(userId: string) {
    return this.prisma.inquiry.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  listAdmin() {
    return this.prisma.inquiry.findMany({ orderBy: { createdAt: "desc" } });
  }

  async answer(id: string, input: InquiryAnswerInput): Promise<void> {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id },
      include: { user: { include: { pushSubscriptions: true } } },
    });
    if (!inquiry) throw new NotFoundException("INQUIRY_NOT_FOUND");

    await this.prisma.inquiry.update({
      where: { id },
      data: { answer: input.answer, status: "ANSWERED", answeredAt: new Date() },
    });

    const email = inquiry.user?.email ?? inquiry.guestEmail;
    if (!email) return;
    await this.outbox.enqueueEmailWithOptionalPush({
      email,
      fcmTokens: inquiry.user?.pushSubscriptions.map((p) => p.fcmToken) ?? [],
      template: "inquiry_answered",
      payload: { inquiryId: id },
    });
  }

  // FR-5.3
  createProductQna(userId: string, input: ProductQnaCreateInput) {
    return this.prisma.productQna.create({ data: { productId: input.productId, userId, question: input.question } });
  }

  listProductQna(productId: string) {
    return this.prisma.productQna.findMany({ where: { productId, isPublic: true }, orderBy: { createdAt: "desc" } });
  }

  answerProductQna(id: string, answer: string) {
    return this.prisma.productQna.update({ where: { id }, data: { answer } });
  }
}
