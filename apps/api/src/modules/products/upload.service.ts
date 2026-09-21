import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { randomUUID } from "node:crypto";

// PRD 8.10절: 관리자 업로드는 백엔드 프록시 방식(브라우저→백엔드→S3). 원본 PDF는 비공개 버킷,
// 샘플/표지는 공개 버킷으로 분리. 매직바이트로 실제 파일 형식을 검증한다(Content-Type 미신뢰).
const PDF_MAGIC = Buffer.from("%PDF-");
const MAX_SIZES = { pdf: 100 * 1024 * 1024, sample: 20 * 1024 * 1024, cover: 5 * 1024 * 1024 };

@Injectable()
export class UploadService {
  private readonly s3: S3Client;
  private readonly privateBucket: string;
  private readonly publicBucket: string;

  constructor(private readonly config: ConfigService) {
    this.s3 = new S3Client({ region: this.config.get("AWS_REGION") });
    this.privateBucket = this.config.get<string>("S3_PRIVATE_BUCKET")!;
    this.publicBucket = this.config.get<string>("S3_PUBLIC_BUCKET")!;
  }

  private assertPdf(buffer: Buffer): void {
    if (!buffer.subarray(0, 5).equals(PDF_MAGIC)) {
      throw new BadRequestException("INVALID_FILE_TYPE_NOT_PDF");
    }
  }

  // 원본 PDF(비공개) — 8.4절: presigned URL로만 접근, key는 응답에 노출하지 않는다.
  async uploadPrivatePdf(buffer: Buffer, sizeBytes: number): Promise<string> {
    if (sizeBytes > MAX_SIZES.pdf) throw new BadRequestException("FILE_TOO_LARGE");
    this.assertPdf(buffer);
    const key = `ebooks/${randomUUID()}.pdf`;
    const upload = new Upload({
      client: this.s3,
      params: { Bucket: this.privateBucket, Key: key, Body: buffer, ContentType: "application/pdf" },
    });
    await upload.done();
    return key;
  }

  async uploadSamplePdf(buffer: Buffer, sizeBytes: number): Promise<string> {
    if (sizeBytes > MAX_SIZES.sample) throw new BadRequestException("FILE_TOO_LARGE");
    this.assertPdf(buffer);
    const key = `samples/${randomUUID()}.pdf`;
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.publicBucket, Key: key, Body: buffer, ContentType: "application/pdf" }),
    );
    return this.publicUrl(key);
  }

  async uploadCoverImage(buffer: Buffer, sizeBytes: number, contentType: string): Promise<string> {
    if (sizeBytes > MAX_SIZES.cover) throw new BadRequestException("FILE_TOO_LARGE");
    if (!contentType.startsWith("image/")) throw new BadRequestException("INVALID_FILE_TYPE_NOT_IMAGE");
    const ext = contentType.split("/")[1] ?? "jpg";
    const key = `covers/${randomUUID()}.${ext}`;
    await this.s3.send(new PutObjectCommand({ Bucket: this.publicBucket, Key: key, Body: buffer, ContentType: contentType }));
    return this.publicUrl(key);
  }

  private publicUrl(key: string): string {
    const region = this.config.get<string>("AWS_REGION");
    return `https://${this.publicBucket}.s3.${region}.amazonaws.com/${key}`;
  }
}
