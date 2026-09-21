"use client";

import { useCartStore } from "../stores/store-provider";

export function AddToCartButton({ productId, title, price }: { productId: string; title: string; price: number }) {
  const addItem = useCartStore((s) => s.addItem);
  const inCart = useCartStore((s) => s.items.some((i) => i.productId === productId));

  return (
    <button
      disabled={inCart}
      onClick={() => addItem({ productId, title, price })}
      className="rounded bg-brand-600 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
    >
      {inCart ? "담김" : "장바구니 담기"}
    </button>
  );
}
