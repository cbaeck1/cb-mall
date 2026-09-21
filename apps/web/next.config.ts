import type { NextConfig } from "next";

// PRD 8.69절 R-1: 함수 리전은 Vercel 프로젝트 설정(vercel.json 또는 대시보드)에서 icn1(서울)로 고정한다.
// 이 파일에서 지정 가능한 것은 로컬 dev 기준 설정뿐이다.
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.s3.*.amazonaws.com" }],
  },
};

export default nextConfig;
