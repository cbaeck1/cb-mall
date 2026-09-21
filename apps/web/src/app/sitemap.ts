import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// PRD 8.43절: 전체 판매중 상품 목록 기반으로 동적 생성, 8.23절과 동일하게 재검증
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://app.cbmall.example";
  const res = await fetch(`${env.NEXT_PUBLIC_API_ORIGIN}/products?page=1`, { next: { revalidate: 3600 } });
  const data = await res.json().catch(() => ({ items: [] }));

  const productUrls = (data.items ?? []).map((p: { id: string }) => ({
    url: `${siteOrigin}/products/${p.id}`,
    changeFrequency: "weekly" as const,
  }));

  return [{ url: siteOrigin, changeFrequency: "daily" }, ...productUrls];
}
