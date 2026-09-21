import { createStore } from "zustand/vanilla";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";
}

export interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setSession: (accessToken: string, user: AuthUser) => void;
  clear: () => void;
}

// PRD 8.7절: Access Token은 브라우저 메모리에만 보관(localStorage/쿠키 아님) — persist 미들웨어를 쓰지 않는다.
export function createAuthStore() {
  return createStore<AuthState>((set) => ({
    accessToken: null,
    user: null,
    setSession: (accessToken, user) => set({ accessToken, user }),
    clear: () => set({ accessToken: null, user: null }),
  }));
}

export type AuthStoreApi = ReturnType<typeof createAuthStore>;
