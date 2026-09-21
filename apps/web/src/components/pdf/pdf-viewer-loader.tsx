"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// PRD 8.64절 M-1: App Router는 Server Component 안에서 `ssr: false`를 허용하지 않는다.
// 이 'use client' 래퍼 안에서만 dynamic(..., { ssr: false })를 호출하고, 상품 상세(Server Component)는
// 이 래퍼만 import한다. 8.29절: 미리보기 버튼을 눌렀을 때만 지연 로드한다.
const SamplePdfViewer = dynamic(() => import("./sample-pdf-viewer").then((m) => m.SamplePdfViewer), {
  ssr: false,
  loading: () => <p className="text-sm text-gray-500">뷰어를 불러오는 중...</p>,
});

export function PdfViewerLoader({ fileUrl }: { fileUrl: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-brand-600 px-4 py-2 text-sm font-medium text-brand-700"
      >
        샘플 미리보기
      </button>
    );
  }

  return <SamplePdfViewer fileUrl={fileUrl} />;
}
