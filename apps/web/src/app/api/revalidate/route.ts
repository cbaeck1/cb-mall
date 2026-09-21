import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

// PRD 8.23/8.51절 C-6/8.66절 O-2: app/api 아래 허용되는 유일한 파일 — BFF가 아니라
// NestJS → Next.js 인바운드 웹훅(캐시 무효화 수신기)이다. 공유 시크릿으로 호출자를 검증한다.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revalidate-secret");
  if (secret !== process.env.CACHE_REVALIDATE_SHARED_SECRET) {
    return NextResponse.json({ message: "INVALID_SECRET" }, { status: 403 });
  }

  const { tag } = (await req.json()) as { tag: string };
  if (!tag) return NextResponse.json({ message: "TAG_REQUIRED" }, { status: 400 });

  revalidateTag(tag);
  return NextResponse.json({ revalidated: true, tag });
}
