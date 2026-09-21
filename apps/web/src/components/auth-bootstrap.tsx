"use client";

import { useEffect } from "react";
import { apiFetch } from "../lib/api/fetcher";
import { useAuthStore } from "../stores/store-provider";

// Access Token은 메모리에만 두므로(8.7절) 새로고침/재방문 시 사라진다. Refresh 쿠키가 남아 있다면
// 클라이언트가 한 번 /auth/refresh를 호출해 세션을 복원한다. 실패하면 조용히 비로그인 상태로 둔다.
export function AuthBootstrap() {
  const setSession = useAuthStore((s) => s.setSession);
  const hasSession = useAuthStore((s) => !!s.accessToken);

  useEffect(() => {
    if (hasSession) return;
    let cancelled = false;

    apiFetch<{ accessToken: string }>("/auth/refresh", { method: "POST", withCredentials: true })
      .then(async ({ accessToken }) => {
        if (cancelled) return;
        const me = await apiFetch<{ id: string; email: string; name: string | null; role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" }>(
          "/auth/me",
          { accessToken },
        );
        if (!cancelled) setSession(accessToken, me);
      })
      .catch(() => undefined); // Refresh 쿠키가 없거나 만료됨 — 비로그인 상태 유지

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
