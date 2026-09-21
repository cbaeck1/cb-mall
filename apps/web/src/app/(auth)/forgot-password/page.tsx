"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@cb-mall/shared-types";
import { apiFetch } from "@/lib/api/fetcher";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const mutation = useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => setSent(true),
  });

  if (sent) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <h1 className="mb-4 text-xl font-bold">메일을 확인해 주세요</h1>
        {/* 8.7절: 사용자 열거 방지를 위해 계정 존재 여부와 무관하게 항상 같은 안내를 보여준다 */}
        <p className="text-sm text-gray-600">해당 이메일이 등록되어 있다면 비밀번호 재설정 링크를 보내드렸습니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-xl font-bold">비밀번호 재설정</h1>
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">이메일</label>
          <input {...register("email")} type="email" className="w-full rounded border px-3 py-2 text-sm" />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded bg-brand-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {mutation.isPending ? "전송 중..." : "재설정 링크 받기"}
        </button>
      </form>
    </div>
  );
}
