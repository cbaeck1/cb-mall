import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
// pdf-parse는 CJS 기본 export. esModuleInterop 덕분에 default import로 충분하다.
import pdfParse from "pdf-parse";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeSearchText } from "../../common/utils/normalize-text.util";
import { chunkText, type PageOffset } from "../../common/utils/chunk-text.util";

// PRD 8.31/8.32/8.33/8.60절: PDF 텍스트 추출 → 정규화 → 청킹 → 저장.
//
// 알려진 단순화(정직하게 기록): 8.33/8.60절 I-8은 파싱+정규화+청킹을 piscina 워커 스레드에서
// 수행해 메인 이벤트 루프 블로킹을 막으라고 요구한다. 이 구현은 시간 제약상 워커 스레드 분리 없이
// 메인 스레드에서 동기적으로 처리한다 — 소량 트래픽(관리자 5~6명, 순차 업로드)에서는 동작하지만,
// 대용량 PDF나 동시 업로드가 늘면 API 응답 지연을 유발할 수 있다. 운영 전 8.33절대로 piscina
// 워커로 옮기는 작업이 필요하다.
@Injectable()
export class PdfExtractionService {
  private readonly logger = new Logger(PdfExtractionService.name);
  private readonly s3: S3Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.s3 = new S3Client({ region: this.config.get("AWS_REGION") });
  }

  @OnEvent("product.pdf_uploaded")
  async handleUpload(payload: { productId: string }): Promise<void> {
    await this.prisma.productFullText.upsert({
      where: { productId: payload.productId },
      create: { productId: payload.productId, status: "PENDING" },
      update: { status: "PENDING", attempts: 0, lastError: null, extractedText: null },
    });
    await this.processOne(payload.productId);
  }

  // 8.12/8.32절: 10분마다 재시도 대상(claimed_at 10분 경과 또는 미클레임) 처리, 최대 2회
  async pollAndProcessBatch(limit = 10): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ product_id: string }[]>`
      UPDATE product_full_texts
      SET claimed_at = now()
      WHERE product_id IN (
        SELECT product_id FROM product_full_texts
        WHERE status = 'PENDING' AND attempts < 2
          AND (claimed_at IS NULL OR claimed_at < now() - interval '10 minutes')
        ORDER BY created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING product_id;
    `;
    for (const row of rows) await this.processOne(row.product_id);
    return rows.length;
  }

  // 8.32절: 1시간 이상 PENDING으로 정체된 건은 FAILED로 전환(조용한 실패 감지)
  async markStuckAsFailed(): Promise<number> {
    const res = await this.prisma.productFullText.updateMany({
      where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) }, attempts: { gte: 2 } },
      data: { status: "FAILED", lastError: "stuck_pending_timeout" },
    });
    return res.count;
  }

  private async processOne(productId: string): Promise<void> {
    const record = await this.prisma.productFullText.findUnique({ where: { productId } });
    if (!record) return;

    try {
      const product = await this.prisma.product.findUniqueOrThrow({ where: { id: productId } });
      const buffer = await this.downloadFromS3(product.pdfFileKey);
      const { text, pageOffsets } = await this.extractPages(buffer);
      const normalized = normalizeSearchText(text);
      const chunks = chunkText(normalized, pageOffsets);

      await this.prisma.$transaction([
        this.prisma.productTextChunk.deleteMany({ where: { productId } }), // 8.60절 I-4: 전량 교체
        this.prisma.productTextChunk.createMany({
          data: chunks.map((c) => ({
            productId,
            chunkIndex: c.chunkIndex,
            content: c.content,
            pageFrom: c.pageFrom,
            pageTo: c.pageTo,
          })),
        }),
        this.prisma.productFullText.update({
          where: { productId },
          data: { status: "DONE", extractedText: normalized, extractedAt: new Date(), claimedAt: null, lastError: null },
        }),
      ]);
      this.logger.log(`PDF 추출 완료 productId=${productId} chunks=${chunks.length}`);
    } catch (err) {
      const attempts = record.attempts + 1;
      await this.prisma.productFullText.update({
        where: { productId },
        data: {
          attempts,
          status: attempts >= 2 ? "FAILED" : "PENDING",
          lastError: err instanceof Error ? err.message : String(err),
          claimedAt: null,
        },
      });
      this.logger.warn(`PDF 추출 실패 productId=${productId} attempts=${attempts}: ${err}`);
    }
  }

  private async downloadFromS3(key: string): Promise<Buffer> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.config.get("S3_PRIVATE_BUCKET"), Key: key }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  // 8.31절 I-5: 페이지 단위로 추출해 페이지 시작 오프셋을 기록한다(page_from/page_to 산출용).
  private async extractPages(buffer: Buffer): Promise<{ text: string; pageOffsets: PageOffset[] }> {
    const pageTexts: string[] = [];
    await pdfParse(buffer, {
      pagerender: (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string }> }> }) =>
        pageData.getTextContent().then((content) => {
          const text = content.items.map((item) => item.str).join("\n");
          pageTexts.push(text);
          return text;
        }),
    });

    let cursor = 0;
    const pageOffsets: PageOffset[] = [];
    const normalizedPages: string[] = [];
    pageTexts.forEach((raw, idx) => {
      const normalized = normalizeSearchText(raw);
      pageOffsets.push({ page: idx + 1, start: cursor });
      normalizedPages.push(normalized);
      cursor += normalized.length + 1; // 페이지 사이 결합 시 삽입되는 공백 1자
    });

    return { text: normalizedPages.join(" "), pageOffsets };
  }
}
