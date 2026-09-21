"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/fetcher";
import type { SearchResponse } from "@cb-mall/shared-types";

// PRD 8.63절: 제출형 검색(타이핑 중 자동검색 없음, L-1), URL이 단일 진실 원천(L-2)
export function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const sort = (searchParams.get("sort") as "recent" | "sales") ?? "recent";
  const page = Number(searchParams.get("page") ?? "1");

  const [draft, setDraft] = useState(q);

  const query = useQuery({
    queryKey: ["search", q, sort, page],
    queryFn: () => apiFetch<SearchResponse>(`/products/search?${new URLSearchParams({ q, sort, page: String(page) })}`),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData, // 8.63절 L-6: 페이지 이동 시 이전 결과 유지
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({ q: draft, sort: "recent", page: "1" });
    router.replace(`/search?${params}`);
  };

  const goToPage = (p: number) => {
    const params = new URLSearchParams({ q, sort, page: String(p) });
    router.replace(`/search?${params}`);
  };

  const is429 = query.error instanceof ApiError && query.error.status === 429;

  return (
    <div>
      <form onSubmit={submit} className="mb-6 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="검색어를 입력하세요 (2자 이상)"
          maxLength={50}
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white">
          검색
        </button>
      </form>

      {is429 && <p className="text-sm text-red-600">잠시 후 다시 시도해 주세요.</p>}

      {query.data && (
        <>
          <p role="status" aria-live="polite" className="mb-4 text-sm text-gray-500">
            총 {query.data.totalLabel}
          </p>
          {!query.data.searchedFields.includes("content") && q.length < 3 && (
            <p className="mb-4 rounded bg-gray-50 p-3 text-sm text-gray-600">
              본문검색은 3글자 이상부터 지원합니다. 지금은 제목·설명·초성만 검색했습니다.
            </p>
          )}

          <ul className="space-y-4">
            {query.data.items.map((item) => (
              <li key={item.productId}>
                <Link href={`/products/${item.productId}`} className="block rounded border p-4 hover:bg-gray-50">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-gray-500">{item.price.toLocaleString()}원</p>
                  {/* 8.61절 J-5: 서버는 오프셋만 반환, 프론트가 slice로 하이라이트(dangerouslySetInnerHTML 사용 안 함) */}
                  {item.snippet && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-700">
                      {item.snippet.text.slice(0, item.snippet.matchStart)}
                      <mark>{item.snippet.text.slice(item.snippet.matchStart, item.snippet.matchStart + item.snippet.matchLength)}</mark>
                      {item.snippet.text.slice(item.snippet.matchStart + item.snippet.matchLength)}
                      {item.snippet.page && <span className="ml-2 text-xs text-gray-400">({item.snippet.page}쪽)</span>}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {query.data.items.length === 0 && <p className="text-sm text-gray-500">검색 결과가 없습니다.</p>}

          <div className="mt-6 flex justify-center gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => goToPage(p)}
                className={`h-8 w-8 rounded text-sm ${p === page ? "bg-brand-600 text-white" : "text-gray-600"}`}
              >
                {p}
              </button>
            ))}
          </div>
          {page >= 10 && <p className="mt-2 text-center text-xs text-gray-400">검색어를 더 구체적으로 입력해 보세요.</p>}
        </>
      )}
    </div>
  );
}
