import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchClient } from "./search-client";

// PRD 8.62절 K-1: 검색 결과 페이지는 noindex + robots.txt 차단 + 비SSR 3중 차단(본문 스니펫 색인 방지)
export const metadata: Metadata = {
  title: "검색",
  robots: { index: false, follow: false },
};

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchClient />
    </Suspense>
  );
}
