/** 自己紹介文に埋め込まれた「10の質問」。保存形式は従来の本文のまま。 */

export const TEN_QUESTIONS_MARKER = '＼＼ 10の質問 ／／';

export const TEN_QUESTIONS = [
  '活動ジャンルは？',
  '一番好きな作品・活動は？',
  '得意なことは？',
  '苦手なことは？',
  '黒歴史は…ある？',
  '好きな時間の過ごし方は？',
  '無人島に1つだけ持ってくなら？',
  '最近ハマって？いることは？',
  'これからの目標は？',
  '最後に一言！',
] as const;

export type TenQuestionsParts = {
  prose: string;
  answers: string[] | null;
};

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function questionLine(index: number): string {
  return `${index + 1}. ${TEN_QUESTIONS[index]}`;
}

export function parseTenQuestions(bio: string): TenQuestionsParts {
  const text = normalizeNewlines(bio);
  const markerAt = text.indexOf(TEN_QUESTIONS_MARKER);
  if (markerAt < 0) return { prose: text, answers: null };

  const prose = text.slice(0, markerAt).replace(/\n+$/g, '');
  const answers = Array.from({ length: TEN_QUESTIONS.length }, () => '');
  const leftover: string[] = [];
  let current = -1;

  for (const line of text.slice(markerAt + TEN_QUESTIONS_MARKER.length).split('\n')) {
    const found = TEN_QUESTIONS.findIndex((question, index) => {
      const prefix = questionLine(index);
      return line === prefix || line.startsWith(`${prefix} `) || line.startsWith(prefix);
    });
    if (found >= 0) {
      current = found;
      const inline = line.slice(questionLine(found).length).trim();
      if (inline) answers[found] = inline;
      continue;
    }
    if (current < 0) {
      if (line.trim()) leftover.push(line);
      continue;
    }
    answers[current] = answers[current] ? `${answers[current]}\n${line}` : line;
  }

  for (let index = 0; index < answers.length; index += 1) {
    answers[index] = answers[index].replace(/^\n+/g, '').replace(/\n+$/g, '');
  }

  const extra = leftover.join('\n').trim();
  return {
    prose: extra ? (prose ? `${prose}\n\n${extra}` : extra) : prose,
    answers,
  };
}

export function serializeTenQuestions(prose: string, answers: string[] | null): string {
  if (!answers) return prose;
  const lines = [TEN_QUESTIONS_MARKER, ''];
  TEN_QUESTIONS.forEach((question, index) => {
    const answer = (answers[index] ?? '').replace(/\n+$/g, '');
    lines.push(`${index + 1}. ${question}`);
    if (answer) {
      lines.push(answer);
      lines.push('');
    }
  });
  while (lines[lines.length - 1] === '') lines.pop();
  const block = lines.join('\n');
  const lead = prose.replace(/\n+$/g, '');
  return lead ? `${lead}\n\n${block}` : block;
}

export function sameTenQuestions(a: string[] | null, b: string[] | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((answer, index) => answer === b[index]);
}

/** 編集していなければ保存済みの本文をそのまま返す。 */
export function bioDraftFromEdit(savedBio: string, prose: string, answers: string[] | null): string {
  const saved = parseTenQuestions(savedBio);
  if (prose === saved.prose && sameTenQuestions(answers, saved.answers)) return savedBio;
  return serializeTenQuestions(prose, answers);
}
