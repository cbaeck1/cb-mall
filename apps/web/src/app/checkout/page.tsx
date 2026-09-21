"use client";

import { useEffect, useRef, useState } from "react";
import { loadTossPayments, type TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import { apiFetch } from "@/lib/api/fetcher";
import { useAuthStore, useCartStore } from "@/stores/store-provider";
import { env } from "@/lib/env";

interface CheckoutOrder {
  id: string;
  tossOrderId: string;
  totalAmount: number;
}

// PRD 8.8절: 토스페이먼츠 결제위젯 SDK v2. 주문 생성(백엔드) → 위젯 렌더 → requestPayment →
// successUrl에서 서버 승인(confirm)까지가 한 흐름이다.
export default function CheckoutPage() {
  const items = useCartStore((s) => s.items);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [guestEmail, setGuestEmail] = useState("");
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const total = items.reduce((sum, i) => sum + i.price, 0);

  useEffect(() => {
    if (!order) return;
    let cancelled = false;

    (async () => {
      const toss = await loadTossPayments(env.NEXT_PUBLIC_TOSS_CLIENT_KEY);
      if (cancelled) return;
      const widgets = toss.widgets({ customerKey: user?.id ?? "ANONYMOUS" });
      widgetsRef.current = widgets;
      await widgets.setAmount({ value: order.totalAmount, currency: "KRW" });
      await widgets.renderPaymentMethods({ selector: "#toss-payment-method" });
      await widgets.renderAgreement({ selector: "#toss-agreement" });
    })();

    return () => {
      cancelled = true;
    };
  }, [order, user?.id]);

  const createOrder = async () => {
    setError(null);
    try {
      const result = await apiFetch<CheckoutOrder>("/orders/checkout", {
        method: "POST",
        body: JSON.stringify({
          productIds: items.map((i) => i.productId),
          guestEmail: user ? undefined : guestEmail,
        }),
        accessToken: user ? (accessToken ?? undefined) : undefined,
        withCredentials: true,
      });
      setOrder(result);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const pay = async () => {
    if (!order || !widgetsRef.current) return;
    await widgetsRef.current.requestPayment({
      orderId: order.tossOrderId,
      orderName: items.length > 1 ? `${items[0]!.title} 외 ${items.length - 1}건` : items[0]!.title,
      successUrl: `${window.location.origin}/checkout/success`,
      failUrl: `${window.location.origin}/checkout/fail`,
      customerEmail: user?.email ?? guestEmail,
    });
  };

  if (items.length === 0) return <p className="text-sm text-gray-500">장바구니가 비어 있습니다.</p>;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-xl font-bold">주문/결제</h1>
      <ul className="mb-4 divide-y rounded border">
        {items.map((i) => (
          <li key={i.productId} className="flex justify-between p-3 text-sm">
            <span>{i.title}</span>
            <span>{i.price.toLocaleString()}원</span>
          </li>
        ))}
      </ul>
      <p className="mb-6 text-right font-semibold">합계 {total.toLocaleString()}원</p>

      {!user && !order && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium">비회원 이메일(주문 확인 및 다운로드 안내)</label>
          <input
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            type="email"
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!order ? (
        <button
          onClick={createOrder}
          disabled={!user && !guestEmail}
          className="w-full rounded bg-brand-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          결제 정보 입력
        </button>
      ) : (
        <>
          <div id="toss-payment-method" className="mb-4" />
          <div id="toss-agreement" className="mb-4" />
          <button onClick={pay} className="w-full rounded bg-brand-600 py-2.5 text-sm font-medium text-white">
            {order.totalAmount.toLocaleString()}원 결제하기
          </button>
        </>
      )}
    </div>
  );
}
