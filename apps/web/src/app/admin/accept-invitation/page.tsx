"use client";

import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { passwordSchema } from "@cb-mall/shared-types";
import { apiFetch } from "@/lib/api/fetcher";

const formSchema = z.object({ name: z.string().trim().min(1).max(50), password: passwordSchema });
type FormInput = z.infer<typeof formSchema>;

// FR-7.8: 초대 수락(공개 접근, 토큰 기반). 8.19절: 완료 후 MFA 설정 화면으로 강제 이동한다.
export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={null}>
      <AcceptInvitationInner />
    </Suspense>
  );
}

function AcceptInvitationInner() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput>({ resolver: zodResolver(formSchema) });

  const mutation = useMutation({
    mutationFn: (input: FormInput) =>
      apiFetch("/admin/accounts/invitations/accept", { method: "POST", body: JSON.stringify({ token, ...input }) }),
    onSuccess: () => router.push("/login?next=/mypage/mfa"),
  });

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-xl font-bold">관리자 계정 설정</h1>
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <input {...register("name")} placeholder="이름" className="w-full rounded border px-3 py-2 text-sm" />
        {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        <input {...register("password")} type="password" placeholder="비밀번호" className="w-full rounded border px-3 py-2 text-sm" />
        {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
        {mutation.isError && <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>}
        <button className="w-full rounded bg-brand-600 py-2.5 text-sm font-medium text-white">계정 설정 완료</button>
      </form>
    </div>
  );
}
