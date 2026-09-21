"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api/fetcher";
import { useCartStore } from "@/stores/store-provider";

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutSuccessInner />
    </Suspense>
  );
}

function CheckoutSuccessInner() {
  const params = useSearchParams();
  const clearCart = useCartStore((s) => s.clear);
  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending");

  useEffect(() => {
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = params.get("amount");
    if (!paymentKey || !orderId || !amount) {
      setStatus("error");
      return;
    }

    apiFetch("/payments/confirm", {
      method: "POST",
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    })
      .then(() => {
        clearCart();
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [params, clearCart]);

  return (
    <div className="mx-auto max-w-sm text-center">
      {status === "pending" && <p className="text-sm text-gray-600">결제를 확인하고 있습니다...</p>}
      {status === "ok" && (
        <>
          <h1 className="mb-4 text-xl font-bold">결제가 완료되었습니다</h1>
          <Link href="/mypage/downloads" className="text-brand-600 underline">
            다운로드하러 가기
          </Link>
        </>
      )}
      {status === "error" && <p className="text-sm text-red-600">결제 확인 중 문제가 발생했습니다. 고객센터로 문의해 주세요.</p>}
    </div>
  );
}
