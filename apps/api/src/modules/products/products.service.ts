import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { extractChosung } from "../../common/utils/korean-chosung.util";
import { UploadService } from "./upload.service";
import type { ProductCreateInput, ProductUpdateInput, ProductListQuery } from "@cb-mall/shared-types";

// PRD FR-2.1~2.6, 8.10/8.21/8.27/8.31절
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly upload: UploadService,
    private readonly events: EventEmitter2,
  ) {}

  async createWithPdf(input: ProductCreateInput, pdf: Buffer, sample?: Buffer, cover?: Buffer) {
    const pdfFileKey = await this.upload.uploadPrivatePdf(pdf, pdf.length);
    const sampleFileUrl = sample ? await this.upload.uploadSamplePdf(sample, sample.length) : null;
    const coverImageUrl = cover ? await this.upload.uploadCoverImage(cover, cover.length, "image/jpeg") : null;

    const product = await this.prisma.product.create({
      data: {
        categoryId: input.categoryId,
        title: input.title,
        titleChosung: extractChosung(input.title),
        description: input.description,
        price: input.price,
        pdfFileKey,
        sampleFileUrl,
        coverImageUrl,
      },
    });

    // 8.31절: 업로드 완료 후 비동기 텍스트 추출 트리거. 부작용은 이벤트로(8.21절), 커밋 이후 발행(8.58절 G-2).
    this.events.emit("product.pdf_uploaded", { productId: product.id });
    return product;
  }

  async update(id: string, input: ProductUpdateInput) {
    const data: Record<string, unknown> = { ...input };
    if (input.title) data.titleChosung = extractChosung(input.title);
    return this.prisma.product.update({ where: { id }, data });
  }

  async updateStatus(id: string, status: "ON_SALE" | "SUSPENDED") {
    return this.prisma.product.update({ where: { id }, data: { status } });
  }

  async replaceFile(id: string, revisionType: "ERRATA" | "MAJOR", pdf: Buffer, note?: string) {
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id } });
    const newKey = await this.upload.uploadPrivatePdf(pdf, pdf.length);

    const [, revision] = await this.prisma.$transaction([
      this.prisma.product.update({ where: { id }, data: { pdfFileKey: newKey } }),
      this.prisma.productRevision.create({
        data: { productId: id, revisionType, fileKey: newKey, note },
      }),
    ]);

    // 8.31절: 파일이 바뀌었으므로 재추출
    this.events.emit("product.pdf_uploaded", { productId: id });

    // FR-2.6/8.73절 V-4/8.75절: 오탈자 수정본만 기존 구매자에게 알림 + 다운로드 한도 +1
    if (revisionType === "ERRATA") {
      this.events.emit("product.revision.errata_published", { productId: id, revisionId: revision.id });
    }
    return { product: product.id, revision: revision.id };
  }

  async findPublicList(query: ProductListQuery) {
    const pageSize = 20;
    const where = {
      status: "ON_SALE" as const,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.minPrice || query.maxPrice
        ? { price: { gte: query.minPrice ?? 0, lte: query.maxPrice ?? 100_000_000 } }
        : {}),
    };
    const orderBy = query.sort === "sales" ? undefined : { createdAt: "desc" as const };
    // 판매순은 orderItems 집계가 필요 — 별도 raw 쿼리로 처리(간결성을 위해 신상품순만 우선 구현, TODO: 판매순 집계 쿼리)
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize };
  }

  async findPublicDetail(id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, status: "ON_SALE" } });
    if (!product) throw new NotFoundException("PRODUCT_NOT_FOUND");
    // 8.10절: pdfFileKey는 절대 응답에 포함하지 않는다.
    const { pdfFileKey: _omit, ...safe } = product;
    return safe;
  }

  async findAdminDetail(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { revisions: { orderBy: { createdAt: "desc" } }, fullText: true },
    });
    if (!product) throw new NotFoundException("PRODUCT_NOT_FOUND");
    return product;
  }
}
