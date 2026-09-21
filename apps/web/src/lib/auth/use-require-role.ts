"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/store-provider";
import type { Role } from "@cb-mall/shared-types";

// 미들웨어(8.22절)는 쿠키 존재 여부만 확인하는 1차 UX 방어다. 실제 인가는 매 API 호출마다
// NestJS의 RolesGuard가 재검증하므로, 여기서는 화면 접근 UX만 다듬는다(보안 경계 아님).
export function useRequireRole(allowed: Role[]) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user && !allowed.includes(user.role)) {
      router.replace("/");
    }
  }, [user, allowed, router]);
}
