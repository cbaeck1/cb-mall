"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inviteAdminSchema, type InviteAdminInput } from "@cb-mall/shared-types";
import { apiFetch } from "@/lib/api/fetcher";
import { useAuthStore } from "@/stores/store-provider";
import { useRequireRole } from "@/lib/auth/use-require-role";

interface AdminAccount {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  mfaEnabled: boolean;
}

// FR-7.8: SUPER_ADMIN 전용
export default function AdminAccountsPage() {
  useRequireRole(["SUPER_ADMIN"]);
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: () => apiFetch<AdminAccount[]>("/admin/accounts", { accessToken: accessToken! }),
    enabled: !!accessToken,
  });

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<InviteAdminInput>({ resolver: zodResolver(inviteAdminSchema) });

  const inviteMutation = useMutation({
    mutationFn: (input: InviteAdminInput) =>
      apiFetch("/admin/accounts/invitations", { method: "POST", body: JSON.stringify(input), accessToken: accessToken! }),
    onSuccess: () => {
      reset();
      qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/accounts/${id}/deactivate`, { method: "PATCH", accessToken: accessToken! }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-accounts"] }),
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">관리자 계정</h1>

      <form onSubmit={handleSubmit((v) => inviteMutation.mutate(v))} className="mb-8 flex gap-2 rounded border p-4">
        <input {...register("email")} type="email" placeholder="초대할 이메일" className="flex-1 rounded border px-3 py-2 text-sm" />
        <select {...register("role")} className="rounded border px-3 py-2 text-sm">
          <option value="ADMIN">ADMIN</option>
          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
        </select>
        <button className="rounded bg-brand-600 px-4 py-2 text-sm text-white">초대</button>
      </form>

      <ul className="divide-y rounded border">
        {query.data?.map((a) => (
          <li key={a.id} className="flex items-center justify-between p-3 text-sm">
            <span>
              {a.email} · {a.role} {!a.mfaEnabled && <span className="text-red-500">(MFA 미설정)</span>}
            </span>
            {a.isActive ? (
              <button onClick={() => deactivateMutation.mutate(a.id)} className="text-xs text-gray-500">
                비활성화
              </button>
            ) : (
              <span className="text-xs text-gray-400">비활성</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
