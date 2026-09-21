"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import { createAuthStore, type AuthStoreApi, type AuthState } from "./auth-store";
import { createCartStore, type CartStoreApi, type CartState } from "./cart-store";

// PRD 8.64절 M-2: 요청/마운트마다 새 스토어 인스턴스를 만드는 Provider 패턴.
// 서버 렌더링 경로에서는 이 스토어를 절대 읽거나 쓰지 않는다 — SSR에 필요한 데이터는 props로 내려준다.
const AuthStoreContext = createContext<AuthStoreApi | null>(null);
const CartStoreContext = createContext<CartStoreApi | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const authStoreRef = useRef<AuthStoreApi | undefined>(undefined);
  if (!authStoreRef.current) authStoreRef.current = createAuthStore();

  const cartStoreRef = useRef<CartStoreApi | undefined>(undefined);
  if (!cartStoreRef.current) cartStoreRef.current = createCartStore();

  // 8.64절 M-3: 마운트 후 명시적 rehydrate — 서버/첫 클라이언트 렌더는 항상 빈 장바구니로 일치시킨다.
  useEffect(() => {
    cartStoreRef.current?.persist.rehydrate();
  }, []);

  return (
    <AuthStoreContext.Provider value={authStoreRef.current}>
      <CartStoreContext.Provider value={cartStoreRef.current}>{children}</CartStoreContext.Provider>
    </AuthStoreContext.Provider>
  );
}

export function useAuthStore<T>(selector: (state: AuthState) => T): T {
  const store = useContext(AuthStoreContext);
  if (!store) throw new Error("useAuthStore는 AppStoreProvider 안에서만 사용할 수 있습니다.");
  return useStore(store, selector);
}

export function useCartStore<T>(selector: (state: CartState) => T): T {
  const store = useContext(CartStoreContext);
  if (!store) throw new Error("useCartStore는 AppStoreProvider 안에서만 사용할 수 있습니다.");
  return useStore(store, selector);
}
