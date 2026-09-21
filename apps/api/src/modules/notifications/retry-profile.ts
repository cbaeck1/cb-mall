// PRD 8.18/8.72절: 긴급/일반 2단계 재시도 프로파일.
// 8.72절 U-1: next_retry_at은 now()+지연이 아니라 createdAt+누적 지연(절대 시각)으로 계산한다 —
// Cron이 1분 주기라 now() 기준이면 지연이 회차마다 누적되어 "총 14분"이 실제로는 17분이 된다.
export type RetryProfileName = "urgent" | "normal";

interface RetryProfile {
  delaysMinutes: number[]; // 실패 후 다음 시도까지의 간격(누적 아님)
  maxAttempts: number; // 초기 1회 + 재시도 횟수
}

// 8.72절 U-6: 긴급 프로파일은 이메일 전용(SMS/푸시는 8.14/8.16절에서 이미 maxAttempts=1)
const PROFILES: Record<RetryProfileName, RetryProfile> = {
  urgent: { delaysMinutes: [1, 3, 10], maxAttempts: 4 }, // 최대 15분(8.72절 U-1)
  normal: { delaysMinutes: [5, 30, 120, 360], maxAttempts: 5 }, // 최대 8.5시간
};

// 8.18절 템플릿별 프로파일 분류. 여기에 없는 템플릿은 normal로 취급한다(8.75절 신규 트리거 포함).
const URGENT_TEMPLATES = new Set(["password_reset", "email_verification", "download_link_guest"]);

export function resolveProfile(template: string): RetryProfileName {
  return URGENT_TEMPLATES.has(template) ? "urgent" : "normal";
}

export function getMaxAttempts(template: string): number {
  return PROFILES[resolveProfile(template)].maxAttempts;
}

// attempts: 지금까지 실패한 횟수(1부터 시작). null을 반환하면 재시도 예산 소진 → FAILED 처리.
export function computeNextRetryAt(template: string, createdAt: Date, attempts: number): Date | null {
  const profile = PROFILES[resolveProfile(template)];
  if (attempts >= profile.maxAttempts) return null;
  const cumulativeMinutes = profile.delaysMinutes.slice(0, attempts).reduce((a, b) => a + b, 0);
  return new Date(createdAt.getTime() + cumulativeMinutes * 60_000);
}
