import { z } from "zod";

export const moneySchema = z.number().int().nonnegative().max(10_000_000);

// FR-2.2 상품 등록/수정 — 관리자 전용
export const productCreateSchema = z.object({
  categoryId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  price: moneySchema,
});
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = productCreateSchema.partial();
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export const productStatusUpdateSchema = z.object({
  status: z.enum(["ON_SALE", "SUSPENDED"]),
});
export type ProductStatusUpdateInput = z.infer<typeof productStatusUpdateSchema>;

// FR-2.3 상품 목록 조회
export const productListQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  sort: z.enum(["recent", "sales"]).default("recent"),
  page: z.coerce.number().int().min(1).max(50).default(1),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

// 8.62절 K-7: 검색어 2~50자, 정렬, page 1~10(8.62 K-5), categoryId 선택
export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "검색어는 2자 이상 입력해 주세요")
    .max(50, "검색어는 50자 이하로 입력해 주세요"),
  sort: z.enum(["recent", "sales"]).default("recent"),
  page: z.coerce.number().int().min(1).max(10).default(1),
  categoryId: z.string().uuid().optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

// FR-2.7 검색 응답 형태 — 8.62절 K-4 / 8.61절 J-5(오프셋만 반환, XSS 방지)
export const searchMatchedInSchema = z.enum(["title", "description", "content"]);
export type SearchMatchedIn = z.infer<typeof searchMatchedInSchema>;

export interface SearchResultItem {
  productId: string;
  title: string;
  price: number;
  coverImageUrl: string | null;
  matchedIn: SearchMatchedIn;
  snippet?: { text: string; matchStart: number; matchLength: number; page: number | null };
}

export interface SearchResponse {
  items: SearchResultItem[];
  page: number;
  totalLabel: string; // "N건" 또는 "200+" (8.62절 K-5)
  searchedFields: SearchMatchedIn[]; // 2자 검색 시 content가 빠짐(8.59절 H-2) — 프론트 안내에 사용
}

// FR-2.4 카테고리
export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(50),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

// FR-5.1 리뷰 — orderItemId만으로 productId·userId가 결정되므로(구매 확정 후 작성) 별도로 받지 않는다.
export const reviewCreateSchema = z.object({
  orderItemId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  content: z.string().trim().max(2000).optional(),
  imageUrls: z.array(z.string().url()).max(5).default([]),
});
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

// FR-5.2 1:1 문의 게시판(상품에 종속되지 않는 일반 문의). 답변 알림 푸시 권한은 작성 후 프론트에서
// 별도로 요청한다(8.75절 P1 — 이 DTO와는 무관).
export const inquiryCreateSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(4000),
});
export type InquiryCreateInput = z.infer<typeof inquiryCreateSchema>;

export const inquiryAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(4000),
});
export type InquiryAnswerInput = z.infer<typeof inquiryAnswerSchema>;

// FR-5.3 상품 Q&A
export const productQnaCreateSchema = z.object({
  productId: z.string().uuid(),
  question: z.string().trim().min(1).max(1000),
});
export type ProductQnaCreateInput = z.infer<typeof productQnaCreateSchema>;
