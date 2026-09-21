"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api/fetcher";
import { useAuthStore } from "@/stores/store-provider";

interface EntitlementItem {
  id: string;
  downloadCount: number;
  maxDownloads: number;
  expiresAt: string;
  orderItem: { product: { title: string } };
}

// FR-4.1~4.5: 잔여 다운로드 횟수·만료일 안내, 다운로드 버튼
export default function MyDownloadsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [errorFor, setErrorFor] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["mypage-downloads"],
    queryFn: () => apiFetch<EntitlementItem[]>("/mypage/downloads", { accessToken: accessToken! }),
    enabled: !!accessToken,
  });

  const downloadMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ downloadUrl: string; remainingDownloads: number }>(`/entitlements/${id}/download`, {
        method: "POST",
        accessToken: accessToken!,
      }),
    onSuccess: (result) => {
      window.location.href = result.downloadUrl; // 8.73절 V-1: 5분간 유효한 presigned URL
      query.refetch();
    },
    onError: (e, id) => setErrorFor(`${id}:${(e as ApiError).message}`),
  });

  if (!query.data) return <p className="text-sm text-gray-500">불러오는 중...</p>;

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">구매·다운로드 내역</h1>
      {query.data.length === 0 && <p className="text-sm text-gray-500">구매한 전자책이 없습니다.</p>}
      <ul className="space-y-4">
        {query.data.map((e) => (
          <li key={e.id} className="rounded border p-4">
            <p className="font-medium">{e.orderItem.product.title}</p>
            <p className="mt-1 text-sm text-gray-500">
              잔여 다운로드 {Math.max(0, e.maxDownloads - e.downloadCount)}회 / 만료일{" "}
              {new Date(e.expiresAt).toLocaleDateString("ko-KR")}
            </p>
            {errorFor?.startsWith(e.id) && <p className="mt-1 text-xs text-red-600">{errorFor.split(":")[1]}</p>}
            <button
              onClick={() => downloadMutation.mutate(e.id)}
              disabled={downloadMutation.isPending}
              className="mt-2 rounded bg-brand-600 px-4 py-1.5 text-sm text-white disabled:opacity-50"
            >
              다운로드
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
