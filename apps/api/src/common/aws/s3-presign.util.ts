import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// PRD 8.73절 V-1: presigned URL 유효기간 5분(기존 30분에서 단축) — 만료 전까지 재사용·공유가
// 가능해 유효기간이 곧 콘텐츠 공개 창이 되므로, 정상 다운로드에 충분하되 최대한 짧게 둔다.
export const DOWNLOAD_URL_TTL_SECONDS = 300;

export async function presignPrivateDownload(
  s3: S3Client,
  bucket: string,
  key: string,
  fileName: string,
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );
}
