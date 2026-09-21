"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetcher";
import { useAuthStore } from "@/stores/store-provider";
import { useRequireRole } from "@/lib/auth/use-require-role";

interface DashboardSummary {
  todayOrderCount: number;
  todayRevenue: number;
  needsReviewCount: number;
  extractionPending: number;
  extractionFailed: number;
  notificationFailedCount: number;
}

// FR-7.1
export default function AdminDashboardPage() {
  useRequireRole(["ADMIN", "SUPER_ADMIN"]);
  const accessToken = useAuthStore((s) => s.accessToken);

  const query = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => apiFetch<DashboardSummary>("/admin/dashboard", { accessToken: accessToken! }),
    enabled: !!accessToken,
    refetchInterval: 60_000,
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">관리자 대시보드</h1>
      <nav className="mb-6 flex gap-4 text-sm">
        <Link href="/admin/products" className="text-brand-600 underline">상품 관리</Link>
        <Link href="/admin/orders" className="text-brand-600 underline">주문 관리</Link>
        <Link href="/admin/accounts" className="text-brand-600 underline">관리자 계정</Link>
      </nav>
      {query.data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card label="오늘 주문" value={`${query.data.todayOrderCount}건`} />
          <Card label="오늘 매출" value={`${query.data.todayRevenue.toLocaleString()}원`} />
          <Card label="검토 대기 주문" value={`${query.data.needsReviewCount}건`} warn={query.data.needsReviewCount > 0} />
          <Card label="본문추출 대기" value={`${query.data.extractionPending}건`} />
          <Card label="본문추출 실패" value={`${query.data.extractionFailed}건`} warn={query.data.extractionFailed > 0} />
          <Card label="알림 발송 실패" value={`${query.data.notificationFailedCount}건`} warn={query.data.notificationFailedCount > 0} />
        </div>
      )}
    </div>
  );
}

function Card({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded border p-4 ${warn ? "border-red-300 bg-red-50" : ""}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
