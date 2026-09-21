"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetcher";
import { useAuthStore } from "@/stores/store-provider";

// PRD 8.19절: TOTP 등록. 관리자는 필수, 일반 회원은 선택.
export default function MfaSetupPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [step, setStep] = useState<"idle" | "setup" | "done">("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const setupMutation = useMutation({
    mutationFn: () => apiFetch<{ secret: string; qrDataUrl: string }>("/mfa/setup", { method: "POST", accessToken: accessToken! }),
    onSuccess: (r) => {
      setQrDataUrl(r.qrDataUrl);
      setStep("setup");
    },
  });

  const enableMutation = useMutation({
    mutationFn: () => apiFetch<{ recoveryCodes: string[] }>("/mfa/enable", { method: "POST", body: JSON.stringify({ code }), accessToken: accessToken! }),
    onSuccess: (r) => {
      setRecoveryCodes(r.recoveryCodes);
      setStep("done");
    },
  });

  if (step === "done") {
    return (
      <div>
        <h1 className="mb-4 text-xl font-bold">2단계 인증이 활성화되었습니다</h1>
        <p className="mb-2 text-sm text-gray-600">아래 복구 코드를 안전한 곳에 보관하세요(1회만 표시됩니다).</p>
        <ul className="rounded bg-gray-50 p-4 font-mono text-sm">
          {recoveryCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (step === "setup") {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-4 text-xl font-bold">인증 앱으로 QR 스캔</h1>
        <img src={qrDataUrl} alt="MFA QR" className="mb-4" />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="6자리 코드"
          maxLength={6}
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <button
          onClick={() => enableMutation.mutate()}
          className="mt-4 w-full rounded bg-brand-600 py-2.5 text-sm font-medium text-white"
        >
          활성화
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">2단계 인증(MFA)</h1>
      <button onClick={() => setupMutation.mutate()} className="rounded bg-brand-600 px-4 py-2 text-sm text-white">
        설정 시작
      </button>
    </div>
  );
}
