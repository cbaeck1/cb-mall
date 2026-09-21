import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeSearchQuery } from "../../common/utils/normalize-text.util";
import { containsPattern } from "../../common/utils/escape-like.util";
import { isAllChosung } from "../../common/utils/korean-chosung.util";
import type { SearchQuery, SearchResponse, SearchResultItem, SearchMatchedIn } from "@cb-mall/shared-types";

interface CandidateRow {
  id: string;
  title: string;
  price: number;
  cover_image_url: string | null;
  created_at: Date;
}
interface ContentCandidateRow extends CandidateRow {
  content: string;
  page_from: number | null;
  match_start: number;
}

// PRD 8.27/8.59~8.63절: 제목·초성 검색 + 본문 청크 검색을 하나의 엔드포인트로 통합.
//
// 알려진 단순화(정직하게 기록): 8.62절 K-5는 DB 레벨 상한 카운트("LIMIT 201 → 200+")를 요구하지만,
// 이 구현은 후보를 각 경로별로 최대 200건 가져와 애플리케이션에서 병합·정렬·페이지네이션한다.
// 카탈로그가 수백~수천 건 규모(PRD 8.27절 전제)에서는 이 방식이 더 간단하고 충분히 빠르며,
// 정확한 SQL 레벨 상한 카운트는 실측 후 필요 시 8.62절 원안대로 교체한다.
const CANDIDATE_LIMIT = 200;
const PAGE_SIZE = 20;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchQuery): Promise<SearchResponse> {
    const normalized = normalizeSearchQuery(query.q); // 8.62절 K-3: 색인과 동일한 정규화
    const pattern = containsPattern(normalized); // 8.62절 K-2: %,_,\ 이스케이프
    const includeContent = normalized.length >= 3; // 8.59절 H-2: 2자 이하는 본문검색 제외

    const titleRows = await this.prisma.$queryRaw<CandidateRow[]>`
      SELECT id, title, price, cover_image_url, created_at
      FROM products
      WHERE status = 'ON_SALE'
        AND (title ILIKE ${pattern} ESCAPE '\\' OR description ILIKE ${pattern} ESCAPE '\\')
        AND (${query.categoryId ?? null}::uuid IS NULL OR category_id = ${query.categoryId ?? null}::uuid)
      LIMIT ${CANDIDATE_LIMIT};
    `;

    let chosungRows: CandidateRow[] = [];
    if (isAllChosung(normalized)) {
      chosungRows = await this.prisma.$queryRaw<CandidateRow[]>`
        SELECT id, title, price, cover_image_url, created_at
        FROM products
        WHERE status = 'ON_SALE' AND title_chosung ILIKE ${pattern} ESCAPE '\\'
          AND (${query.categoryId ?? null}::uuid IS NULL OR category_id = ${query.categoryId ?? null}::uuid)
        LIMIT ${CANDIDATE_LIMIT};
      `;
    }

    let contentRows: ContentCandidateRow[] = [];
    if (includeContent) {
      // 8.61절 J-2: 대소문자 불일치 방지(strpos는 대소문자 구분이므로 양쪽 모두 lower)
      // 8.61절 J-3: DISTINCT ON으로 상품당 1건(책에서 가장 먼저 나오는 위치)
      contentRows = await this.prisma.$queryRaw<ContentCandidateRow[]>`
        SELECT * FROM (
          SELECT DISTINCT ON (p.id)
            p.id, p.title, p.price, p.cover_image_url, p.created_at,
            ptc.content, ptc.page_from,
            GREATEST(strpos(lower(ptc.content), lower(${normalized})) - 1, 0) AS match_start
          FROM product_text_chunks ptc
          JOIN products p ON p.id = ptc.product_id
          WHERE p.status = 'ON_SALE' AND ptc.content ILIKE ${pattern} ESCAPE '\\'
            AND (${query.categoryId ?? null}::uuid IS NULL OR p.category_id = ${query.categoryId ?? null}::uuid)
          ORDER BY p.id, ptc.chunk_index
        ) sub
        LIMIT ${CANDIDATE_LIMIT};
      `;
    }

    const seen = new Set<string>();
    const items: (SearchResultItem & { _createdAt: Date })[] = [];

    // 8.62절 K-4: 제목·초성 매칭을 본문 매칭보다 우선한다.
    for (const row of [...titleRows, ...chosungRows]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      items.push(this.toItem(row, "title", row.created_at)); // 초성 매칭도 제목 기반이므로 matchedIn="title"
    }
    for (const row of contentRows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      items.push({
        ...this.toItem(row, "content", row.created_at),
        snippet: this.buildSnippet(row.content, row.match_start, normalized.length, row.page_from),
      });
    }

    this.sortItems(items, query.sort);

    const total = items.length;
    const totalLabel = total > CANDIDATE_LIMIT ? "200+" : `${total}건`;
    const start = (query.page - 1) * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE).map(({ _createdAt, ...rest }) => rest);

    const searchedFields: SearchMatchedIn[] = includeContent ? ["title", "description", "content"] : ["title", "description"];
    return { items: pageItems, page: query.page, totalLabel, searchedFields };
  }

  private toItem(row: CandidateRow, matchedIn: SearchMatchedIn, createdAt: Date): SearchResultItem & { _createdAt: Date } {
    return {
      productId: row.id,
      title: row.title,
      price: row.price,
      coverImageUrl: row.cover_image_url,
      matchedIn,
      _createdAt: createdAt,
    };
  }

  // 8.61절 J-6: 양 끝을 공백 경계까지 조정(최대 10자), 잘린 쪽에 … 표시. J-5: 오프셋만 반환(XSS 방지, 프론트가 slice)
  private buildSnippet(content: string, matchStart: number, matchLength: number, page: number | null) {
    const RADIUS = 20;
    let start = Math.max(0, matchStart - RADIUS);
    let end = Math.min(content.length, matchStart + matchLength + RADIUS);

    const spaceBefore = content.lastIndexOf(" ", start + 10);
    if (spaceBefore > start && spaceBefore < matchStart) start = spaceBefore + 1;
    const spaceAfter = content.indexOf(" ", end - 10);
    if (spaceAfter !== -1 && spaceAfter < end + 10 && spaceAfter > matchStart) end = spaceAfter;

    const prefix = start > 0 ? "…" : "";
    const suffix = end < content.length ? "…" : "";
    const text = prefix + content.slice(start, end) + suffix;

    return {
      text,
      matchStart: matchStart - start + prefix.length,
      matchLength,
      page,
    };
  }

  private sortItems(items: { price: number; _createdAt: Date }[], sort: "recent" | "sales"): void {
    // TODO: 판매순(sales)은 주문 집계가 필요 — products.service.ts와 동일한 단순화, 현재는 최신순으로 대체
    void sort;
    items.sort((a, b) => b._createdAt.getTime() - a._createdAt.getTime());
  }
}
