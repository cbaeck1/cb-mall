"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetcher";
import { useAuthStore } from "@/stores/store-provider";
import { useRequireRole } from "@/lib/auth/use-require-role";

interface AdminOrder {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: { productTitleSnapshot: string }[];
}

// FR-3.3, FR-7.3, 8.71절 T-2
export default function AdminOrdersPage() {
  useRequireRole(["ADMIN", "SUPER_ADMIN"]);
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const query = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => apiFetch<{ items: AdminOrder[] }>("/admin/orders", { accessToken: accessToken! }),
    enabled: !!accessToken,
  });

  const resolveMutation = useMutation({
    mutationFn: (params: { id: string; resolution: "REFUND" | "RESTORE" }) =>
      apiFetch(`/admin/orders/${params.id}/resolve-review`, {
        method: "PATCH",
        body: JSON.stringify({ resolution: params.resolution, note }),
        accessToken: accessToken!,
      }),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">주문 관리</h1>
      <ul className="divide-y rounded border">
        {query.data?.items.map((o) => (
          <li key={o.id} className="p-4 text-sm">
            <div className="flex justify-between">
              <span>{o.items.map((i) => i.productTitleSnapshot).join(", ")}</span>
              <span className={o.status === "NEEDS_REVIEW" ? "font-semibold text-red-600" : "text-gray-500"}>{o.status}</span>
            </div>
            <p className="mt-1 text-gray-500">
              {o.totalAmount.toLocaleString()}원 · {new Date(o.createdAt).toLocaleString("ko-KR")}
            </p>
            {o.status === "NEEDS_REVIEW" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="처리 사유"
                  className="flex-1 rounded border px-2 py-1 text-xs"
                />
                <button
                  onClick={() => resolveMutation.mutate({ id: o.id, resolution: "RESTORE" })}
                  className="rounded bg-brand-600 px-3 py-1 text-xs text-white"
                >
                  주문 복구
                </button>
                <button
                  onClick={() => resolveMutation.mutate({ id: o.id, resolution: "REFUND" })}
                  className="rounded bg-red-600 px-3 py-1 text-xs text-white"
                >
                  환불 처리
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
