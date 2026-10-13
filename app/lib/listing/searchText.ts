/**
 * 検索・カテゴリ用の正規化と 2-gram。
 * 正規化は既存の /api/users と同じ（小文字、長音・空白・記号を除く）。
 * 2文字以上は先頭2-gramで候補を最大200件読み、名前・肩書の部分一致で残す。
 * 同じ2-gramが200件を超えると、読まなかった候補の一致は欠ける。1文字は全件走査になるため受け付けない。
 */

export const SEARCH_READ_BUDGET = 200;

export const CATEGORY_LABELS = ['ダンサー', 'YouTuber', 'インフルエンサー', 'モデル', '歌手'] as const;

export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ー−―─]/g, '')
    .replace(/\s/g, '')
    .replace(/[^\wぁ-んァ-ン一-龥]/g, '');
}

export function bigrams(text: string): string[] {
  const normalized = normalizeSearchText(text);
  const grams: string[] = [];
  for (let i = 0; i < normalized.length - 1; i += 1) {
    grams.push(normalized.slice(i, i + 2));
  }
  return [...new Set(grams)];
}

/** プロフィールに保存する検索トークン。名前と肩書の 2-gram のみ。 */
export function searchTokensFor(name: string, title: string): string[] {
  return [...new Set([...bigrams(name), ...bigrams(title)])].slice(0, 80);
}

/** クエリの先頭2-gram。2文字未満なら null。 */
export function queryToken(q: string): string | null {
  const normalized = normalizeSearchText(q);
  if (normalized.length < 2) return null;
  return normalized.slice(0, 2);
}

/** 既存仕様の部分一致。候補を絞ったあとの精度判定に使う。 */
export function matchesSubstring(name: string, title: string, q: string): boolean {
  const needle = normalizeSearchText(q);
  if (needle.length < 2) return false;
  const nameN = normalizeSearchText(name);
  const titleN = normalizeSearchText(title);
  const combined = normalizeSearchText(`${name} ${title}`);
  return nameN.includes(needle) || titleN.includes(needle) || combined.includes(needle);
}

/**
 * 読み取り予算内の候補だけを部分一致で残す。
 * 予算より候補が多いときは truncated。予算外の一致は返さない。
 */
export function matchWithinBudget<T extends { name: string; title: string }>(
  candidates: readonly T[],
  q: string,
  budget = SEARCH_READ_BUDGET
): { matched: T[]; truncated: boolean } {
  const scanned = candidates.slice(0, budget);
  return {
    matched: scanned.filter((row) => matchesSubstring(row.name, row.title, q)),
    truncated: candidates.length > budget,
  };
}

export function categorySlugsForTitle(title: string): string[] {
  const titleN = normalizeSearchText(title);
  return CATEGORY_LABELS.filter((label) => titleN.includes(normalizeSearchText(label)));
}
