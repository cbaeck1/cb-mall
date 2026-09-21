import type { MetadataRoute } from "next";

// PRD 8.43/8.62절 K-1: /admin·/mypage·인증 관련·/api/*·/search 차단, 상품 목록/상세는 허용(AI 크롤러 포함)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/mypage", "/api", "/search", "/login", "/signup", "/checkout", "/reset-password", "/verify-email"],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://app.cbmall.example"}/sitemap.xml`,
  };
}
