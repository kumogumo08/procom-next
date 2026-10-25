/**
 * プロフィールのブロック配置。
 * コンテンツ本体は既存フィールドのまま、並びと形式だけを扱う。
 *
 * - blockLayoutVersion が未設定（undefined）: 旧形式。従来の sectionOrder と AppProjects 補完。
 * - blockLayoutVersion === 1: 新形式。sectionOrder にある既知のキーだけ。空配列は全削除。補完しない。
 * - それ以外（null、文字列、2 以上など）: 未対応。既知キーの並びだけを表示し、既定順への置換や補完はしない。
 *   読み取りだけで version を 1 に書き換えない。未対応形式の並び替え結果は保存側で無視する。
 */

export const BLOCK_TYPES = [
  'YouTube',
  'X',
  'Instagram',
  'TikTok',
  'Facebook',
  'BannerLinks',
  'AppProjects',
  'SNSButtons',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_LABELS: Record<BlockType, string> = {
  YouTube: 'YouTube',
  X: 'X（旧Twitter）',
  Instagram: 'Instagram',
  TikTok: 'TikTok',
  Facebook: 'Facebook',
  BannerLinks: 'リンクバナー',
  AppProjects: 'アプリ紹介',
  SNSButtons: 'SNSボタン',
};

/** 新形式の現在バージョン。旧データには書き込まない。 */
export const BLOCK_LAYOUT_VERSION = 1;

/** 旧形式で sectionOrder が無いとき、および空配列のときの表示順。 */
export const DEFAULT_SECTION_ORDER: readonly BlockType[] = BLOCK_TYPES;

export type BlockLayoutMode = 'legacy' | 'v1' | 'unsupported';

export function isKnownBlockType(value: unknown): value is BlockType {
  return typeof value === 'string' && (BLOCK_TYPES as readonly string[]).includes(value);
}

/**
 * フィールドが無いときだけ旧形式。
 * null や数値以外は「未設定」と区別し、旧形式の補完を適用しない。
 */
export function blockLayoutMode(blockLayoutVersion: unknown): BlockLayoutMode {
  if (blockLayoutVersion === undefined) return 'legacy';
  if (blockLayoutVersion === BLOCK_LAYOUT_VERSION) return 'v1';
  return 'unsupported';
}

export function isLegacyBlockLayout(blockLayoutVersion: unknown): boolean {
  return blockLayoutMode(blockLayoutVersion) === 'legacy';
}

export function isV1BlockLayout(blockLayoutVersion: unknown): boolean {
  return blockLayoutMode(blockLayoutVersion) === 'v1';
}

function uniqueKnownBlocks(order: unknown): BlockType[] {
  if (!Array.isArray(order)) return [];
  const seen = new Set<BlockType>();
  const result: BlockType[] = [];
  for (const item of order) {
    if (!isKnownBlockType(item) || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

/** 旧形式の AppProjects 補完。既に含まれていれば並びは変えない。 */
function ensureAppProjectsInLegacyOrder(order: string[]): string[] {
  if (order.includes('AppProjects')) return order;
  const snsIdx = order.indexOf('SNSButtons');
  if (snsIdx >= 0) {
    return [...order.slice(0, snsIdx), 'AppProjects', ...order.slice(snsIdx)];
  }
  return [...order, 'AppProjects'];
}

function legacySectionOrder(sectionOrder: unknown): string[] {
  if (Array.isArray(sectionOrder) && sectionOrder.length > 0) {
    const strings = sectionOrder.filter((item): item is string => typeof item === 'string');
    return ensureAppProjectsInLegacyOrder(strings);
  }
  return ensureAppProjectsInLegacyOrder([...DEFAULT_SECTION_ORDER]);
}

/**
 * 画面に出すセクション順。
 * 保存値そのものは書き換えない。旧形式の表示結果は、従来の page.tsx と同じ規則。
 */
export function resolveSectionOrder(sectionOrder: unknown, blockLayoutVersion: unknown): string[] {
  const mode = blockLayoutMode(blockLayoutVersion);
  if (mode === 'legacy') return legacySectionOrder(sectionOrder);
  return uniqueKnownBlocks(sectionOrder);
}

/**
 * 並び替え UI の結果を下書きへ反映する直前の判定。
 * 未対応バージョンは null。呼び出し側は保存も表示順も変えない。
 */
export function sectionOrderDraftFromReorder(
  nextOrder: readonly string[],
  blockLayoutVersion: unknown
): string[] | null {
  if (blockLayoutMode(blockLayoutVersion) === 'unsupported') return null;
  return resolveSectionOrder(nextOrder, blockLayoutVersion);
}

function clampInsertIndex(index: number | undefined, length: number): number {
  if (index == null || typeof index !== 'number' || !Number.isFinite(index)) return length;
  const truncated = Math.trunc(index);
  if (truncated < 0) return 0;
  if (truncated > length) return length;
  return truncated;
}

/** 未配置の既知ブロックを足す。配置済み・不明なキーは増やさない。 */
export function addBlock(order: readonly string[], block: string, index?: number): string[] {
  const base = uniqueKnownBlocks(order);
  if (!isKnownBlockType(block) || base.includes(block)) return base;
  const next = [...base];
  next.splice(clampInsertIndex(index, next.length), 0, block);
  return next;
}

/** 配置から外す。コンテンツ用フィールドは受け取らない。 */
export function removeBlock(order: readonly string[], block: string): string[] {
  const base = uniqueKnownBlocks(order);
  if (!isKnownBlockType(block)) return base;
  return base.filter((key) => key !== block);
}

/** 配置済みキーを指定位置へ動かす。未配置・範囲外・不明なキーでは並べ替えない。 */
export function moveBlock(order: readonly string[], block: string, toIndex: number): string[] {
  const base = uniqueKnownBlocks(order);
  if (!isKnownBlockType(block)) return base;
  const from = base.indexOf(block);
  if (from < 0) return base;
  if (typeof toIndex !== 'number' || !Number.isFinite(toIndex)) return base;
  const dest = Math.min(Math.max(Math.trunc(toIndex), 0), base.length - 1);
  if (dest === from) return base;
  const next = [...base];
  const [item] = next.splice(from, 1);
  next.splice(dest, 0, item);
  return next;
}

export function isBlockPlaced(order: readonly string[], block: string): boolean {
  return isKnownBlockType(block) && order.includes(block);
}

export function availableBlocks(order: readonly string[]): BlockType[] {
  const placed = new Set(uniqueKnownBlocks(order));
  return BLOCK_TYPES.filter((block) => !placed.has(block));
}

export type LayoutSaveFields = {
  sectionOrder?: string[];
  blockLayoutVersion?: number;
};

/**
 * 一括保存に載せるレイアウト項目。
 * version が無い旧データには blockLayoutVersion を足さない。
 * 未対応バージョンで sectionOrder 自体が無い場合は、空配列を新たに書かない。
 */
export function layoutFieldsForSave(
  settings: object | undefined,
  fallbackOrder: readonly string[]
): LayoutSaveFields {
  const record = (settings ?? {}) as { sectionOrder?: unknown; blockLayoutVersion?: unknown };
  const version = record.blockLayoutVersion;
  const withVersion: LayoutSaveFields =
    typeof version === 'number' && Number.isFinite(version) ? { blockLayoutVersion: version } : {};
  const rawOrder = record.sectionOrder;

  if (blockLayoutMode(version) === 'unsupported' && !Array.isArray(rawOrder)) {
    return withVersion;
  }

  const sectionOrder: string[] = Array.isArray(rawOrder) ? [...(rawOrder as string[])] : [...fallbackOrder];
  return { ...withVersion, sectionOrder };
}

/** 未保存比較用。version が数値のときだけ比較に含める。 */
export function comparableLayoutFields(settings: unknown): {
  sectionOrder: unknown;
  blockLayoutVersion?: number;
} {
  const record =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? (settings as { sectionOrder?: unknown; blockLayoutVersion?: unknown })
      : {};
  const version = record.blockLayoutVersion;
  return {
    sectionOrder: record.sectionOrder,
    ...(typeof version === 'number' && Number.isFinite(version) ? { blockLayoutVersion: version } : {}),
  };
}

/**
 * profile.settings のマージ。
 * 既存のスプレッドと同じく、incoming にあるキーだけ上書きする。
 * blockLayoutVersion は有限な数値だけを受け取る。不正な値では既存の数値を残す。
 */
export function mergeProfileSettings(existing: unknown, incoming: unknown): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const next =
    incoming && typeof incoming === 'object' && !Array.isArray(incoming)
      ? { ...(incoming as Record<string, unknown>) }
      : {};
  const merged: Record<string, unknown> = { ...base, ...next };

  if (Object.prototype.hasOwnProperty.call(next, 'blockLayoutVersion')) {
    const version = next.blockLayoutVersion;
    if (typeof version === 'number' && Number.isFinite(version)) {
      merged.blockLayoutVersion = version;
    } else if (typeof base.blockLayoutVersion === 'number' && Number.isFinite(base.blockLayoutVersion)) {
      merged.blockLayoutVersion = base.blockLayoutVersion;
    } else {
      delete merged.blockLayoutVersion;
    }
  }

  if (merged.blockLayoutVersion === BLOCK_LAYOUT_VERSION && Array.isArray(merged.sectionOrder)) {
    merged.sectionOrder = uniqueKnownBlocks(merged.sectionOrder);
  }

  return merged;
}

/**
 * 将来のブロック編集が明示的に新形式へ切り替えるときのスナップショット。
 * 旧形式では、切り替えた瞬間の表示順を sectionOrder に固定する。
 * 未対応バージョンは変換しない。保存処理からは呼ばない。
 */
export type BlockPlacementEdit =
  | { op: 'add'; block: string; index?: number }
  | { op: 'remove'; block: string };

/**
 * ブロックの追加・取り外し。
 * 旧形式のときだけ activateBlockLayout で表示順を固定してから操作する。
 * 未対応バージョンは null。並び替えからは呼ばない。
 */
export function editBlockPlacement(
  settings: { sectionOrder?: unknown; blockLayoutVersion?: unknown } | undefined,
  edit: BlockPlacementEdit
): { blockLayoutVersion: typeof BLOCK_LAYOUT_VERSION; sectionOrder: string[] } | null {
  const version = settings?.blockLayoutVersion;
  if (blockLayoutMode(version) === 'unsupported') return null;
  const base =
    version === BLOCK_LAYOUT_VERSION
      ? {
          blockLayoutVersion: BLOCK_LAYOUT_VERSION,
          sectionOrder: resolveSectionOrder(settings?.sectionOrder, version),
        }
      : activateBlockLayout(settings?.sectionOrder, version);
  if (!base) return null;
  const sectionOrder =
    edit.op === 'add'
      ? addBlock(base.sectionOrder, edit.block, edit.index)
      : removeBlock(base.sectionOrder, edit.block);
  return { blockLayoutVersion: BLOCK_LAYOUT_VERSION, sectionOrder };
}

export function activateBlockLayout(
  sectionOrder: unknown,
  blockLayoutVersion: unknown
): { blockLayoutVersion: typeof BLOCK_LAYOUT_VERSION; sectionOrder: string[] } | null {
  if (blockLayoutMode(blockLayoutVersion) === 'unsupported') return null;
  return {
    blockLayoutVersion: BLOCK_LAYOUT_VERSION,
    sectionOrder: resolveSectionOrder(sectionOrder, blockLayoutVersion),
  };
}
