import type { Metadata } from "next";
import { Suspense } from "react";
import LoginPage from "./login-client";

export const metadata: Metadata = { title: "로그인" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
