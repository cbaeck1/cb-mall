import { env } from "../env";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ApiFetchOptions extends RequestInit {
  accessToken?: string;
  // 8.7절: 로그인/refresh 등 httpOnly 쿠키가 필요한 요청에만 true
  withCredentials?: boolean;
}

// PRD 8.22절: 브라우저가 api. 도메인을 직접 호출한다(BFF 경유 없음, 8.66절 O-1).
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { accessToken, withCredentials, headers, ...rest } = options;
  const res = await fetch(`${env.NEXT_PUBLIC_API_ORIGIN}${path}`, {
    ...rest,
    credentials: withCredentials ? "include" : "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? "REQUEST_FAILED");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// 8.10절: 관리자 파일 업로드(백엔드 프록시)는 multipart/form-data라 JSON Content-Type을 강제하면 안 된다
// — apiFetch와 별도로 둔다(브라우저가 FormData의 boundary를 자동으로 설정하게 둠).
export async function apiFetchForm<T>(path: string, formData: FormData, accessToken: string): Promise<T> {
  const res = await fetch(`${env.NEXT_PUBLIC_API_ORIGIN}${path}`, {
    method: "POST",
    body: formData,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? "REQUEST_FAILED");
  }
  return res.json() as Promise<T>;
}
