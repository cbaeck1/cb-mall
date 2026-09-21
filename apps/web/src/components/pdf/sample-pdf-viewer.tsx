"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";

// PRD 8.29/8.64절 M-5: workerSrc는 react-pdf 컴포넌트를 사용하는 바로 이 모듈에서 설정한다
// (별도 파일에 두면 모듈 실행 순서 때문에 기본값에 덮어써지는 함정이 있다).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export function SamplePdfViewer({ fileUrl }: { fileUrl: string }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [failed, setFailed] = useState(false);

  // 8.64절 M-7: 구형 브라우저(Promise.withResolvers 미지원 등)에서는 그레이스풀 디그레이드
  if (failed) {
    return (
      <div className="rounded border border-dashed p-6 text-center text-sm text-gray-600">
        <p className="mb-2">이 브라우저에서는 미리보기를 표시할 수 없습니다.</p>
        <a href={fileUrl} className="text-brand-600 underline" download>
          샘플 PDF 직접 다운로드
        </a>
      </div>
    );
  }

  return (
    <div className="rounded border p-2">
      <Document file={fileUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)} onLoadError={() => setFailed(true)}>
        <Page pageNumber={pageNumber} width={480} />
      </Document>
      {numPages && (
        <div className="mt-2 flex items-center justify-center gap-4 text-sm">
          <button
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => p - 1)}
            className="disabled:opacity-30"
          >
            이전
          </button>
          <span>
            {pageNumber} / {numPages}
          </span>
          <button
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber((p) => p + 1)}
            className="disabled:opacity-30"
          >
            다음
          </button>
          <a href={fileUrl} className="ml-4 text-brand-600 underline" download>
            다운로드
          </a>
        </div>
      )}
    </div>
  );
}
