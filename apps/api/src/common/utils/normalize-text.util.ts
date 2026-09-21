// PRD 8.60절 I-1: PDF 추출 텍스트 정규화. 색인 시점과 검색어 질의 시점 모두 이 함수를 거쳐야 한다(8.62절 K-3) —
// 한쪽만 정규화하면 NFD 한글(macOS 복사 등)을 붙여넣은 사용자가 결과 0건을 받고도 원인을 알 수 없다.
const GHOST_CHARS = /[\u00AD\u200B\uFEFF]/g; // soft hyphen, ZWSP, BOM
const NBSP = /\u00A0/g;

export function normalizeSearchText(input: string): string {
  let text = input.normalize("NFC");
  text = text.replace(NBSP, " ");
  text = text.replace(GHOST_CHARS, "");
  // 영문 하이픈 줄바꿈 결합: "com-\npany" → "company"
  text = text.replace(/([a-zA-Z])-\r?\n([a-zA-Z])/g, "$1$2");
  // 한글-한글 사이 개행은 공백 없이 결합 (8.60절 I-1 ④, 8.61절 J-7에서 검증: 한국어 기본 줄바꿈은 음절 단위)
  text = text.replace(/([가-힣])\r?\n([가-힣])/g, "$1$2");
  // 그 외 개행은 공백으로
  text = text.replace(/\r?\n/g, " ");
  // 연속 공백 축약
  text = text.replace(/[ \t]{2,}/g, " ").trim();
  return text;
}

// 검색어 전용: 색인과 같은 정규화 + trim (8.62절 K-3)
export function normalizeSearchQuery(input: string): string {
  return normalizeSearchText(input);
}
