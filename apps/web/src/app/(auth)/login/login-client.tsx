"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { loginSchema, type LoginInput } from "@cb-mall/shared-types";
import { apiFetch } from "@/lib/api/fetcher";
import { useAuthStore } from "@/stores/store-provider";

interface LoginResult {
  accessToken?: string;
  mfaRequired?: boolean;
  mfaPendingToken?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const [mfaPendingToken, setMfaPendingToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const afterLogin = async (accessToken: string) => {
    const me = await apiFetch<{ id: string; email: string; name: string | null; role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN" }>(
      "/auth/me",
      { accessToken },
    );
    setSession(accessToken, me);
    router.push(searchParams.get("next") ?? "/mypage");
  };

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch<LoginResult>("/auth/login", { method: "POST", body: JSON.stringify(input), withCredentials: true }), // 8.7절: Refresh 쿠키 수신
    onSuccess: async (result) => {
      if (result.mfaRequired && result.mfaPendingToken) {
        setMfaPendingToken(result.mfaPendingToken);
        return;
      }
      if (result.accessToken) await afterLogin(result.accessToken);
    },
  });

  const mfaMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ accessToken: string }>("/auth/mfa/login-verify", {
        method: "POST",
        body: JSON.stringify({ mfaPendingToken, code: mfaCode }),
        withCredentials: true,
      }),
    onSuccess: (result) => afterLogin(result.accessToken),
  });

  if (mfaPendingToken) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-6 text-xl font-bold">2단계 인증</h1>
        <input
          value={mfaCode}
          onChange={(e) => setMfaCode(e.target.value)}
          placeholder="인증 앱의 6자리 코드"
          maxLength={6}
          className="w-full rounded border px-3 py-2 text-sm"
        />
        {mfaMutation.isError && <p className="mt-2 text-sm text-red-600">{(mfaMutation.error as Error).message}</p>}
        <button
          onClick={() => mfaMutation.mutate()}
          className="mt-4 w-full rounded bg-brand-600 py-2.5 text-sm font-medium text-white"
        >
          확인
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-xl font-bold">로그인</h1>
      <form onSubmit={handleSubmit((v) => loginMutation.mutate(v))} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">이메일</label>
          <input {...register("email")} type="email" className="w-full rounded border px-3 py-2 text-sm" />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">비밀번호</label>
          <input {...register("password")} type="password" className="w-full rounded border px-3 py-2 text-sm" />
        </div>
        {loginMutation.isError && <p className="text-sm text-red-600">{(loginMutation.error as Error).message}</p>}
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full rounded bg-brand-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loginMutation.isPending ? "로그인 중..." : "로그인"}
        </button>
        <div className="flex justify-between text-xs text-gray-500">
          <a href="/signup">회원가입</a>
          <a href="/reset-password">비밀번호를 잊으셨나요?</a>
        </div>
      </form>
    </div>
  );
}
