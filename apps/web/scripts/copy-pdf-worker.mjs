// PRD 8.64절 M-4/M-5: pdfjs-dist 워커 파일을 postinstall에서 자동으로 public/에 복사한다.
// pdfjs-dist를 업그레이드하면 워커 버전도 저절로 따라오게 하기 위함(버전 불일치 시 "API version
// does not match the Worker version" 실패를 방지).
import { copyFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const workerPath = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
  const dest = join(__dirname, "..", "public", "pdf.worker.min.mjs");
  copyFileSync(workerPath, dest);
  console.log(`pdf.worker.min.mjs 복사 완료: ${workerPath} → ${dest}`);
} catch (err) {
  if (existsSync(join(__dirname, "..", "public", "pdf.worker.min.mjs"))) {
    console.warn("pdfjs-dist 워커 파일을 찾지 못했지만 기존 public/pdf.worker.min.mjs를 유지합니다.", err.message);
  } else {
    console.error("pdfjs-dist 워커 파일 복사 실패 — 샘플 PDF 미리보기가 동작하지 않을 수 있습니다.", err);
  }
}
