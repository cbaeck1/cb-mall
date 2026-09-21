import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { env } from "@/lib/env";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { PdfViewerLoader } from "@/components/pdf/pdf-viewer-loader";

interface ProductDetail {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  price: number;
  discountPrice: number | null;
  coverImageUrl: string | null;
  sampleFileUrl: string | null;
  pageCount: number | null;
}

async function getProduct(id: string): Promise<ProductDetail | null> {
  const res = await fetch(`${env.NEXT_PUBLIC_API_ORIGIN}/products/${id}`, {
    next: { revalidate: 300, tags: [`product:${id}`] },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("PRODUCT_FETCH_FAILED");
  return res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return { title: "상품을 찾을 수 없습니다" };
  return {
    title: product.title,
    description: product.description?.slice(0, 150),
    openGraph: { images: product.coverImageUrl ? [product.coverImageUrl] : [] },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const price = product.discountPrice ?? product.price;

  return (
    <div className="grid gap-8 md:grid-cols-[280px_1fr]">
      <div className="aspect-[3/4] overflow-hidden rounded bg-gray-100">
        {product.coverImageUrl && (
          <Image src={product.coverImageUrl} alt={product.title} width={280} height={373} className="h-full w-full object-cover" />
        )}
      </div>
      <div>
        <h1 className="text-2xl font-bold">{product.title}</h1>
        {product.author && <p className="mt-1 text-sm text-gray-500">{product.author}</p>}
        <p className="mt-4 text-xl font-semibold">{price.toLocaleString()}원</p>
        {product.pageCount && <p className="mt-1 text-sm text-gray-500">{product.pageCount}쪽</p>}

        <div className="mt-6 flex gap-3">
          <AddToCartButton productId={product.id} title={product.title} price={price} />
        </div>

        {product.description && <p className="mt-6 whitespace-pre-line text-sm text-gray-700">{product.description}</p>}

        {product.sampleFileUrl && (
          <div className="mt-8">
            <h2 className="mb-2 text-lg font-semibold">샘플 미리보기</h2>
            <PdfViewerLoader fileUrl={product.sampleFileUrl} />
          </div>
        )}
      </div>
    </div>
  );
}
