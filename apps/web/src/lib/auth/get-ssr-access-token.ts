import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { env } from "../env";

// PRD 8.53/8.66절 O-1: BFF Route Handler 없이 서버 전용 헬퍼 함수로 SSR 토큰 릴레이를 구현한다.
// Server Component가 쿠키를 "읽기만" 해서 비회전 SSR 전용 엔드포인트를 직접 호출한다.
//
// 8.69절:
//   R-2: 3초 타임아웃 + 재시도 없음(ECS 지연이 그대로 504로 전이되는 것을 막는다)
//   R-5: React cache()로 감싸 같은 렌더에서 여러 Server Component가 불러도 렌더당 1회만 호출
const getSsrAccessTokenUncached = async (): Promise<string | null> => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(process.env.NODE_ENV === "production" ? "__Secure-refresh_token" : "refresh_token")?.value;
  if (!raw) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_API_ORIGIN}/auth/ssr-token`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-ssr-relay-secret": process.env.SSR_RELAY_SHARED_SECRET ?? "",
      },
      body: JSON.stringify({ refreshToken: raw }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const { accessToken } = (await res.json()) as { accessToken: string };
    return accessToken;
  } catch {
    return null; // 타임아웃/네트워크 오류 — 재시도하지 않고 호출부가 우아하게 저하 처리
  } finally {
    clearTimeout(timeout);
  }
};

export const getSsrAccessToken = cache(getSsrAccessTokenUncached);
