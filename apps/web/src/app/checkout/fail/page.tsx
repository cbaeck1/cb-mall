"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function CheckoutFailPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutFailInner />
    </Suspense>
  );
}

function CheckoutFailInner() {
  const message = useSearchParams().get("message") ?? "결제가 취소되었거나 실패했습니다.";

  return (
    <div className="mx-auto max-w-sm text-center">
      <h1 className="mb-4 text-xl font-bold">결제 실패</h1>
      <p className="mb-6 text-sm text-gray-600">{message}</p>
      <Link href="/cart" className="text-brand-600 underline">
        장바구니로 돌아가기
      </Link>
    </div>
  );
}
