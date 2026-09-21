"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api/fetcher";
import { useAuthStore, useCartStore } from "../stores/store-provider";

export function SiteHeader() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clear);

  const handleLogout = async () => {
    await apiFetch("/auth/logout", { method: "POST", withCredentials: true }).catch(() => undefined);
    clearAuth();
    router.push("/");
  };
  // 8.64절 M-3: hasHydrated 전에는 개수를 렌더하지 않아 서버/클라이언트 첫 렌더를 일치시킨다.
  const hasHydrated = useCartStore((s) => s.hasHydrated);
  const cartCount = useCartStore((s) => s.items.length);

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold text-brand-700">
          cb몰
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/search">검색</Link>
          <Link href="/cart">장바구니{hasHydrated && cartCount > 0 ? ` (${cartCount})` : ""}</Link>
          {user ? (
            <>
              <Link href="/mypage">마이페이지</Link>
              {(user.role === "ADMIN" || user.role === "SUPER_ADMIN") && <Link href="/admin">관리자</Link>}
              <button onClick={handleLogout} className="text-gray-500">
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link href="/login">로그인</Link>
              <Link href="/signup">회원가입</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
