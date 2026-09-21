// PRD 8.62절 K-2: 검색어의 %, _, \ 를 이스케이프한 뒤 패턴을 조립하고 쿼리에 ESCAPE '\' 를 명시한다.
// 이걸 빠뜨리면 q="%" 하나로 ILIKE '%%%'가 되어 전 테이블이 매칭되고, 8.59절이 청크 분할까지 해가며
// 없앤 전수 스캔이 사용자 입력만으로 되살아난다. Prisma $queryRaw 태그드 템플릿은 SQL 인젝션은 막아도
// LIKE 와일드카드는 막지 못하므로(8.62절 K-2) 이 이스케이프는 별개로 반드시 필요하다.
export function escapeLikePattern(raw: string): string {
  const backslashEscaped = raw.split("\\").join("\\\\");
  const percentEscaped = backslashEscaped.split("%").join("\\%");
  const underscoreEscaped = percentEscaped.split("_").join("\\_");
  return underscoreEscaped;
}

export function containsPattern(raw: string): string {
  return `%${escapeLikePattern(raw)}%`;
}
