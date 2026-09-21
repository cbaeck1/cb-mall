"use client";

import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { passwordSchema } from "@cb-mall/shared-types";
import { apiFetch } from "@/lib/api/fetcher";

const formSchema = z.object({ newPassword: passwordSchema });
type FormInput = z.infer<typeof formSchema>;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput>({ resolver: zodResolver(formSchema) });

  const mutation = useMutation({
    mutationFn: (input: FormInput) =>
      apiFetch("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, newPassword: input.newPassword }) }),
    onSuccess: () => router.push("/login"),
  });

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-xl font-bold">새 비밀번호 설정</h1>
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">새 비밀번호</label>
          <input {...register("newPassword")} type="password" className="w-full rounded border px-3 py-2 text-sm" />
          {errors.newPassword && <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>}
        </div>
        {mutation.isError && <p className="text-sm text-red-600">링크가 만료되었을 수 있습니다. 다시 요청해 주세요.</p>}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded bg-brand-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          변경하기
        </button>
      </form>
    </div>
  );
}
