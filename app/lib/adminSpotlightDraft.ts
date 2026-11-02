/** 管理画面の TOP 掲載チェック。保存するまで API も Firestore も触らない。 */

export type SpotlightDraftRow = {
  uid: string;
  spotlightOff: boolean;
};

export function dirtySpotlightRows<T extends SpotlightDraftRow>(
  rows: readonly T[],
  saved: Readonly<Record<string, boolean>>
): T[] {
  return rows.filter((row) => saved[row.uid] !== row.spotlightOff);
}

export function applySpotlightToggle<T extends SpotlightDraftRow>(
  rows: readonly T[],
  uid: string,
  nextOn: boolean
): T[] {
  const nextOff = !nextOn;
  return rows.map((row) => (row.uid === uid ? { ...row, spotlightOff: nextOff } : row));
}

export function discardSpotlightDraft<T extends SpotlightDraftRow>(
  rows: readonly T[],
  saved: Readonly<Record<string, boolean>>
): T[] {
  return rows.map((row) =>
    saved[row.uid] === undefined ? row : { ...row, spotlightOff: saved[row.uid] }
  );
}

/** 成功した UID だけ保存済みにする。失敗分の下書きは残る。 */
export function commitSpotlightSaves(
  saved: Readonly<Record<string, boolean>>,
  rows: readonly SpotlightDraftRow[],
  succeededUids: readonly string[]
): Record<string, boolean> {
  const draft = new Map(rows.map((row) => [row.uid, row.spotlightOff]));
  const next = { ...saved };
  for (const uid of succeededUids) {
    const value = draft.get(uid);
    if (value !== undefined) next[uid] = value;
  }
  return next;
}

export function canStartSave(inFlight: boolean, dirtyCount: number): boolean {
  return !inFlight && dirtyCount > 0;
}
