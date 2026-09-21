"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetcher";
import { useAuthStore } from "@/stores/store-provider";

interface OrderItem {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: { productTitleSnapshot: string }[];
}

export default function MyOrdersPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const query = useQuery({
    queryKey: ["mypage-orders"],
    queryFn: () => apiFetch<OrderItem[]>("/mypage/orders", { accessToken: accessToken! }),
    enabled: !!accessToken,
  });

  if (!query.data) return <p className="text-sm text-gray-500">불러오는 중...</p>;

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">주문 내역</h1>
      {query.data.length === 0 && <p className="text-sm text-gray-500">주문 내역이 없습니다.</p>}
      <ul className="space-y-4">
        {query.data.map((o) => (
          <li key={o.id} className="rounded border p-4 text-sm">
            <p className="text-gray-500">{new Date(o.createdAt).toLocaleDateString("ko-KR")}</p>
            <p className="font-medium">{o.items.map((i) => i.productTitleSnapshot).join(", ")}</p>
            <p className="mt-1">
              {o.totalAmount.toLocaleString()}원 · {o.status}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
