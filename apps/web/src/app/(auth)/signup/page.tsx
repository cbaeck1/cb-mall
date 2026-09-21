"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { signupSchema, type SignupInput } from "@cb-mall/shared-types";
import { apiFetch } from "@/lib/api/fetcher";

export default function SignupPage() {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  const mutation = useMutation({
    mutationFn: (input: SignupInput) => apiFetch("/auth/signup", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => setDone(true),
  });

  if (done) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <h1 className="mb-4 text-xl font-bold">가입 완료</h1>
        <p className="text-sm text-gray-600">
          입력하신 이메일로 인증 메일을 보냈습니다. 메일함을 확인해 이메일 인증을 완료해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-xl font-bold">회원가입</h1>
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">이메일</label>
          <input {...register("email")} type="email" className="w-full rounded border px-3 py-2 text-sm" />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">비밀번호</label>
          <input {...register("password")} type="password" className="w-full rounded border px-3 py-2 text-sm" />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">이름(선택)</label>
          <input {...register("name")} className="w-full rounded border px-3 py-2 text-sm" />
        </div>
        {mutation.isError && <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded bg-brand-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {mutation.isPending ? "가입 중..." : "가입하기"}
        </button>
      </form>
    </div>
  );
}
