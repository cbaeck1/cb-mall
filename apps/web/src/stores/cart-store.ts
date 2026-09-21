import { createStore } from "zustand/vanilla";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CartItem {
  productId: string;
  title: string;
  price: number;
}

export interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
}

// PRD 8.64절 M-3: persist는 skipHydration:true로 두고 클라이언트 마운트 후 명시적으로 rehydrate한다.
// 서버(빈 장바구니)와 첫 클라이언트 렌더가 일치해야 hydration mismatch가 나지 않는다.
export function createCartStore() {
  return createStore<CartState>()(
    persist(
      (set, get) => ({
        items: [],
        hasHydrated: false,
        setHasHydrated: (v) => set({ hasHydrated: v }),
        addItem: (item) => {
          if (get().items.some((i) => i.productId === item.productId)) return; // 전자책 특성상 중복 담기 불가
          set({ items: [...get().items, item] });
        },
        removeItem: (productId) => set({ items: get().items.filter((i) => i.productId !== productId) }),
        clear: () => set({ items: [] }),
      }),
      {
        name: "cb-mall-cart",
        storage: createJSONStorage(() => localStorage),
        skipHydration: true,
        partialize: (state) => ({ items: state.items }) as CartState,
      },
    ),
  );
}

export type CartStoreApi = ReturnType<typeof createCartStore>;
