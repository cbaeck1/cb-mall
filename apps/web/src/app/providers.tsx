"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppStoreProvider } from "../stores/store-provider";
import { AuthBootstrap } from "../components/auth-bootstrap";

export function Providers({ children }: { children: ReactNode }) {
  // 서버에서 요청마다 새 QueryClient가 생기도록 useState 팩토리 형태로 생성(공식 권장 패턴)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            // 8.63절 L-4: 4xx는 재시도하지 않는다(429를 재시도하면 제한 상황을 더 악화시킨다)
            retry: (failureCount, error: unknown) => {
              const status = (error as { status?: number })?.status;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AppStoreProvider>
        <AuthBootstrap />
        {children}
      </AppStoreProvider>
    </QueryClientProvider>
  );
}
