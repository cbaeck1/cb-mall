"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productCreateSchema, type ProductCreateInput } from "@cb-mall/shared-types";
import { apiFetch, apiFetchForm } from "@/lib/api/fetcher";
import { useAuthStore } from "@/stores/store-provider";
import { useRequireRole } from "@/lib/auth/use-require-role";

interface Category {
  id: string;
  name: string;
}
interface ProductListItem {
  id: string;
  title: string;
  price: number;
  status: string;
}

// FR-2.1~2.2, 8.10절: 백엔드 프록시 업로드(원본 PDF·샘플·표지)
export default function AdminProductsPage() {
  useRequireRole(["ADMIN", "SUPER_ADMIN"]);
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<Category[]>("/categories"),
  });

  const productsQuery = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => apiFetch<{ items: ProductListItem[] }>("/products?page=1").then((r) => r.items),
    enabled: !!accessToken,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductCreateInput>({ resolver: zodResolver(productCreateSchema) });

  const createMutation = useMutation({
    mutationFn: async (input: ProductCreateInput) => {
      if (!pdfFile) throw new Error("원본 PDF 파일을 선택해 주세요.");
      const form = new FormData();
      form.append("categoryId", input.categoryId);
      form.append("title", input.title);
      form.append("description", input.description);
      form.append("price", String(input.price));
      form.append("pdf", pdfFile);
      if (sampleFile) form.append("sample", sampleFile);
      if (coverFile) form.append("cover", coverFile);
      return apiFetchForm("/admin/products", form, accessToken!);
    },
    onSuccess: () => {
      reset();
      setPdfFile(null);
      setSampleFile(null);
      setCoverFile(null);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">상품 관리</h1>

      <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} className="mb-8 space-y-3 rounded border p-4">
        <h2 className="font-semibold">신규 상품 등록</h2>
        <select {...register("categoryId")} className="w-full rounded border px-3 py-2 text-sm">
          <option value="">카테고리 선택</option>
          {categoriesQuery.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.categoryId && <p className="text-xs text-red-600">{errors.categoryId.message}</p>}

        <input {...register("title")} placeholder="제목" className="w-full rounded border px-3 py-2 text-sm" />
        <textarea {...register("description")} placeholder="소개" rows={3} className="w-full rounded border px-3 py-2 text-sm" />
        <input {...register("price", { valueAsNumber: true })} type="number" placeholder="가격" className="w-full rounded border px-3 py-2 text-sm" />

        <div className="space-y-2 text-sm">
          <label className="block">
            원본 PDF(필수, 최대 100MB)
            <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
          </label>
          <label className="block">
            샘플 PDF(선택, 최대 20MB)
            <input type="file" accept="application/pdf" onChange={(e) => setSampleFile(e.target.files?.[0] ?? null)} />
          </label>
          <label className="block">
            표지 이미지(선택, 최대 5MB)
            <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        {createMutation.isError && <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>}
        <button disabled={createMutation.isPending} className="rounded bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">
          {createMutation.isPending ? "업로드 중..." : "등록"}
        </button>
      </form>

      <ul className="divide-y rounded border">
        {productsQuery.data?.map((p) => (
          <li key={p.id} className="flex justify-between p-3 text-sm">
            <span>{p.title}</span>
            <span className="text-gray-500">
              {p.price.toLocaleString()}원 · {p.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
