import Link from "next/link";
import Image from "next/image";
import { env } from "@/lib/env";

interface ProductListItem {
  id: string;
  title: string;
  price: number;
  discountPrice: number | null;
  coverImageUrl: string | null;
}

async function getProducts(): Promise<ProductListItem[]> {
  // 공개 상품 목록 — 개인화되지 않은 데이터라 SSR + Next.js Data Cache로 캐싱해도 안전(8.23절)
  const res = await fetch(`${env.NEXT_PUBLIC_API_ORIGIN}/products`, {
    next: { revalidate: 300, tags: ["product:list"] },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items ?? [];
}

export default async function HomePage() {
  const products = await getProducts();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">신간 전자책</h1>
      {products.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 상품이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.id}`} className="block">
              <div className="mb-2 aspect-[3/4] overflow-hidden rounded bg-gray-100">
                {p.coverImageUrl && (
                  <Image src={p.coverImageUrl} alt={p.title} width={240} height={320} className="h-full w-full object-cover" />
                )}
              </div>
              <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
              <p className="text-sm text-gray-600">{(p.discountPrice ?? p.price).toLocaleString()}원</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
