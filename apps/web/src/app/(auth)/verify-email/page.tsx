"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api/fetcher";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const token = useSearchParams().get("token");
  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    apiFetch("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => setStatus("ok"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="mx-auto max-w-sm text-center">
      <h1 className="mb-4 text-xl font-bold">이메일 인증</h1>
      {status === "pending" && <p className="text-sm text-gray-600">인증 처리 중입니다...</p>}
      {status === "ok" && <p className="text-sm text-green-700">이메일 인증이 완료되었습니다. 로그인해 주세요.</p>}
      {status === "error" && <p className="text-sm text-red-600">인증 링크가 만료되었거나 올바르지 않습니다.</p>}
    </div>
  );
}
