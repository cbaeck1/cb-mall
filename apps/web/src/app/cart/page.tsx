"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/stores/store-provider";

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const hasHydrated = useCartStore((s) => s.hasHydrated);
  const router = useRouter();

  const total = items.reduce((sum, i) => sum + i.price, 0);

  if (!hasHydrated) return null; // 8.64절 M-3: rehydrate 전에는 렌더 보류(hydration mismatch 방지)

  if (items.length === 0) {
    return (
      <div className="text-center">
        <p className="mb-4 text-sm text-gray-500">장바구니가 비어 있습니다.</p>
        <Link href="/" className="text-brand-600 underline">
          상품 둘러보기
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">장바구니</h1>
      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.productId} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-sm text-gray-500">{item.price.toLocaleString()}원</p>
            </div>
            <button onClick={() => removeItem(item.productId)} className="text-sm text-gray-400">
              삭제
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <p className="font-semibold">합계 {total.toLocaleString()}원</p>
        <button
          onClick={() => router.push("/checkout")}
          className="rounded bg-brand-600 px-6 py-2.5 text-sm font-medium text-white"
        >
          주문하기
        </button>
      </div>
    </div>
  );
}
