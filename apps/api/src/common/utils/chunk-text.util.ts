// PRD 8.60절: 본문 청크 분할 — 목표 1,000자(±200), 문단>문장>공백 경계 우선, 인접 청크 50자 오버랩,
// 경계가 없으면 1,200자 강제 컷(표·수식 등). 8.59절 H-1의 재검사(recheck) 비용을 없애기 위한 조치.
export interface PageOffset {
  page: number; // PDF 기준 N페이지 (8.60절 I-6: 인쇄 쪽번호와 다를 수 있음을 UI에서 명시)
  start: number; // 정규화된 전체 텍스트 안에서 이 페이지가 시작하는 문자 오프셋
}

export interface TextChunk {
  chunkIndex: number;
  content: string;
  pageFrom: number | null;
  pageTo: number | null;
}

const TARGET = 1000;
const TOLERANCE = 200;
const FORCE_CUT = 1200;
const OVERLAP = 50;

function findBreakPoint(text: string, from: number, to: number): number | null {
  const window = text.slice(from, to);
  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph !== -1) return from + paragraph + 2;
  // 문장 종결: 한국어 종결어미(다./요./까?/죠.) + 일반 구두점(./!/?)
  const sentenceRe = /[.!?](?=\s|$)|(다|요|까|죠)\.(?=\s|$)/g;
  let lastSentenceEnd: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = sentenceRe.exec(window))) {
    lastSentenceEnd = m.index + m[0].length;
  }
  if (lastSentenceEnd !== null) return from + lastSentenceEnd;
  const space = window.lastIndexOf(" ");
  if (space !== -1) return from + space + 1;
  return null;
}

function pageForOffset(offsets: PageOffset[], charOffset: number): number | null {
  if (offsets.length === 0) return null;
  let page = offsets[0]!.page;
  for (const o of offsets) {
    if (o.start <= charOffset) page = o.page;
    else break;
  }
  return page;
}

export function chunkText(text: string, pageOffsets: PageOffset[] = []): TextChunk[] {
  const chunks: TextChunk[] = [];
  let cursor = 0;
  let index = 0;

  while (cursor < text.length) {
    const minEnd = Math.min(cursor + TARGET - TOLERANCE, text.length);
    const maxEnd = Math.min(cursor + TARGET + TOLERANCE, text.length);
    let end: number;

    if (maxEnd >= text.length) {
      end = text.length;
    } else {
      const breakPoint = findBreakPoint(text, Math.max(cursor + 1, minEnd), maxEnd);
      end = breakPoint ?? Math.min(cursor + FORCE_CUT, text.length);
    }

    const content = text.slice(cursor, end);
    if (content.trim().length > 0) {
      const startOffset = cursor;
      const endOffset = end - 1;
      chunks.push({
        chunkIndex: index++,
        content,
        pageFrom: pageForOffset(pageOffsets, startOffset),
        pageTo: pageForOffset(pageOffsets, endOffset),
      });
    }

    if (end >= text.length) break;
    cursor = Math.max(end - OVERLAP, cursor + 1); // 8.60절 I-2: 인접 청크 50자 오버랩
  }

  return chunks;
}
