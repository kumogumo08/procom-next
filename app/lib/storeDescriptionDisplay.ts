/** 表示用: 1行あたりのおおよその幅（超過時は切って ,,, を付ける） */
const MAX_LINE_CHARS = 120;
/** 表示用: 最大行数 */
const MAX_LINES = 5;

/**
 * ストア説明の表示用。改行を活かしつつ最大5行相当で短縮し、続きがあるときは末尾に `,,,` を付ける。
 */
export function formatStoreDescription(text?: string | null): string {
  if (text == null || typeof text !== 'string') return '';
  let s = text.replace(/\r\n/g, '\n').trim();
  if (!s) return '';
  s = s.replace(/[ \t\u3000]+/g, ' ');
  const rawLines = s.split('\n').map((line) => line.trim());

  let truncated = false;
  if (rawLines.length > MAX_LINES) truncated = true;

  const outLines = rawLines.slice(0, MAX_LINES);
  if (outLines.length === MAX_LINES) {
    const last = outLines[MAX_LINES - 1];
    if (last.length > MAX_LINE_CHARS) {
      outLines[MAX_LINES - 1] = last.slice(0, MAX_LINE_CHARS);
      truncated = true;
    }
  }

  return outLines.join('\n') + (truncated ? ',,,' : '');
}
