import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { ReviewCreateInput } from "@cb-mall/shared-types";

// FR-5.1: 구매 확정 후 리뷰 작성(텍스트+사진)
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: ReviewCreateInput) {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: input.orderItemId },
      include: { order: true, review: true },
    });
    if (!orderItem) throw new BadRequestException("ORDER_ITEM_NOT_FOUND");
    if (orderItem.order.userId !== userId) throw new ForbiddenException("NOT_YOUR_ORDER");
    if (orderItem.order.status !== "PAID") throw new BadRequestException("ORDER_NOT_PAID");
    if (orderItem.review) throw new ConflictException("REVIEW_ALREADY_EXISTS");

    return this.prisma.review.create({
      data: {
        productId: orderItem.productId,
        userId,
        orderItemId: orderItem.id,
        rating: input.rating,
        content: input.content,
        imageUrls: input.imageUrls,
      },
    });
  }

  listByProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
}
