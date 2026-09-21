// PRD 8.27절: 초성 검색용 컬럼(title_chosung) 계산. 상품 등록/수정 시 애플리케이션에서 호출한다.
const CHOSUNG_LIST = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const CHOSUNG_UNIT = 588; // 21(중성) * 28(종성)

export function extractChosung(text: string): string {
  let result = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= HANGUL_BASE && code <= HANGUL_END) {
      const index = Math.floor((code - HANGUL_BASE) / CHOSUNG_UNIT);
      result += CHOSUNG_LIST[index];
    } else {
      result += ch;
    }
  }
  return result;
}

// 검색어가 전부 초성으로만 구성됐는지 판별 (8.27절: 초성 컬럼 매칭으로 분기하는 조건)
export function isAllChosung(query: string): boolean {
  return query.length > 0 && [...query].every((ch) => CHOSUNG_LIST.includes(ch));
}
