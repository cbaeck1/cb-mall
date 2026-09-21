"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inquiryCreateSchema, type InquiryCreateInput } from "@cb-mall/shared-types";
import { apiFetch } from "@/lib/api/fetcher";
import { useAuthStore } from "@/stores/store-provider";

interface InquiryItem {
  id: string;
  subject: string;
  content: string;
  status: string;
  answer: string | null;
}

// FR-5.2, 8.75절 P1: 문의 작성 직후 답변 알림 푸시 권한을 안내(별도 버튼 — 이 폼과는 무관하게 브라우저 API 호출)
export default function MyInquiriesPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["mypage-inquiries"],
    queryFn: () => apiFetch<InquiryItem[]>("/mypage/inquiries", { accessToken: accessToken! }),
    enabled: !!accessToken,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InquiryCreateInput>({ resolver: zodResolver(inquiryCreateSchema) });

  const createMutation = useMutation({
    mutationFn: (input: InquiryCreateInput) =>
      apiFetch("/inquiries", { method: "POST", body: JSON.stringify(input), accessToken: accessToken! }),
    onSuccess: () => {
      reset();
      qc.invalidateQueries({ queryKey: ["mypage-inquiries"] });
      requestPushPermission();
    },
  });

  const requestPushPermission = () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission().catch(() => undefined);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">1:1 문의</h1>

      <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} className="mb-8 space-y-3 rounded border p-4">
        <input {...register("subject")} placeholder="제목" className="w-full rounded border px-3 py-2 text-sm" />
        {errors.subject && <p className="text-xs text-red-600">{errors.subject.message}</p>}
        <textarea {...register("content")} placeholder="문의 내용" rows={4} className="w-full rounded border px-3 py-2 text-sm" />
        {errors.content && <p className="text-xs text-red-600">{errors.content.message}</p>}
        <button className="rounded bg-brand-600 px-4 py-2 text-sm text-white">문의하기</button>
      </form>

      <ul className="space-y-4">
        {query.data?.map((inq) => (
          <li key={inq.id} className="rounded border p-4 text-sm">
            <p className="font-medium">{inq.subject}</p>
            <p className="mt-1 text-gray-600">{inq.content}</p>
            {inq.answer ? (
              <p className="mt-2 rounded bg-gray-50 p-2 text-gray-700">답변: {inq.answer}</p>
            ) : (
              <p className="mt-2 text-xs text-gray-400">답변 대기 중</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
