// Нормалізація відповідей гравців і кодів документів.
// Відповідь спершу зводиться до канонічного рядка, а вже його хеш порівнюється з правильними.

export type AnswerSpec =
  | { kind: 'number'; min: number; max: number; step: number }
  | { kind: 'time'; min: string; max: string }
  | { kind: 'choice'; options: Record<string, string[]> };

const decimalsOf = (step: number) => (String(step).split('.')[1] ?? '').length;

function canonNumber(v: number, step: number): string {
  const d = decimalsOf(step);
  const rounded = Math.round(v / step) * step;
  return String(Number(rounded.toFixed(d)));
}

const NUMBER_RE = /-?\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/;

/** «16.11.74», «16-11-74», «16/11/74» — дата, набрана як код: цифри підряд. */
const DATE_CODE_RE = /^\s*(\d{1,2})\s*([./-])\s*(\d{1,2})\s*\2\s*(\d{2,4})\s*$/;

function parseNumber(raw: string): number | null {
  const d = raw.match(DATE_CODE_RE);
  if (d) return Number(d[1] + d[3] + d[4]);
  const m = raw.match(NUMBER_RE);
  if (!m) return null;
  const v = Number(m[0].replace(/[  ]/g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const fmtTime = (min: number) => {
  const t = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

function parseTime(raw: string): string | null {
  const s = raw.trim();
  let h: number, m: number;
  const sep = s.match(/^(\d{1,2})\s*[:.,\s-]\s*(\d{2})$/);
  const packed = s.match(/^(\d{3,4})$/);
  if (sep) [h, m] = [Number(sep[1]), Number(sep[2])];
  else if (packed) [h, m] = [Number(packed[1].slice(0, -2)), Number(packed[1].slice(-2))];
  else return null;
  if (h > 23 || m > 59) return null;
  return fmtTime(h * 60 + m);
}

// Латинські літери, що виглядають як кириличні (після toLowerCase).
const LOOKALIKES: Record<string, string> = { a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', i: 'і', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у' };

export const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .replace(/[a-z]/g, (ch) => LOOKALIKES[ch] ?? ch)
    .replace(/['’ʼ`]/g, '')
    .replace(/[.,!?;:"«»“”„()\[\]\/\\–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function normalizeAnswer(spec: AnswerSpec, raw: string): string | null {
  switch (spec.kind) {
    case 'number': {
      const v = parseNumber(raw);
      return v === null ? null : canonNumber(v, spec.step);
    }
    case 'time':
      return parseTime(raw);
    case 'choice': {
      const t = normalizeText(raw);
      for (const [id, synonyms] of Object.entries(spec.options)) if (synonyms.some((x) => normalizeText(x) === t)) return id;
      return null;
    }
  }
}

export function acceptedCanon(spec: AnswerSpec): string[] {
  switch (spec.kind) {
    case 'number': {
      const out: string[] = [];
      const n = Math.round((spec.max - spec.min) / spec.step);
      for (let i = 0; i <= n; i++) out.push(canonNumber(spec.min + i * spec.step, spec.step));
      return out;
    }
    case 'time': {
      const a = toMinutes(spec.min);
      let b = toMinutes(spec.max);
      if (b < a) b += 1440; // через північ
      const out: string[] = [];
      for (let t = a; t <= b; t++) out.push(fmtTime(t));
      return out;
    }
    case 'choice':
      return Object.keys(spec.options);
  }
}

/** «АС-114», «ac 114», «114» або URL з «/code/114» → 114. */
export function normalizeCode(raw: string): number | null {
  const fromUrl = raw.match(/\/code\/(\d+)/);
  const digits = fromUrl ? fromUrl[1] : raw.replace(/\D/g, '');
  if (!digits) return null;
  return Number(digits);
}

/** Те, що знає клієнт про форму відповіді: без меж і без списку правильних варіантів. */
export type CheckKind = { kind: 'number'; step: number } | { kind: 'time' } | { kind: 'text' };

export function checkKindOf(spec: AnswerSpec): CheckKind {
  if (spec.kind === 'number') return { kind: 'number', step: spec.step };
  if (spec.kind === 'time') return { kind: 'time' };
  return { kind: 'text' };
}

export function canonForCheck(kind: CheckKind, raw: string): string | null {
  if (kind.kind === 'number') {
    const v = parseNumber(raw);
    return v === null ? null : canonNumber(v, kind.step);
  }
  if (kind.kind === 'time') return parseTime(raw);
  const t = normalizeText(raw);
  return t || null;
}

/** Канонічні рядки, хеші яких лягають у збірку. Для вибору — нормалізовані синоніми. */
export function acceptedForCheck(spec: AnswerSpec): string[] {
  if (spec.kind === 'choice') return Object.values(spec.options).flat().map(normalizeText);
  return acceptedCanon(spec);
}

// Організаційно-правові форми, які гравці пишуть або ні: «ТОВ «Байда-Буд»» = «Байда-Буд».
const LEGAL_FORMS = new Set(['тов', 'прат', 'пат', 'ат', 'бф', 'ск', 'фоп', 'кп', 'пп']);

const queryWords = (s: string) =>
  normalizeText(s)
    .split(' ')
    .map((w) => w.replace(/[^0-9a-zа-щьюяґєії]/g, ''))
    .filter((w) => w.length > 1 && !LEGAL_FORMS.has(w));

/**
 * Запит до бази даних поліції: два ключі — слова в порядку введення і впорядковані.
 * Без розділових знаків, правових форм та ініціалів. Так «ВХ 4717 АК» = «вх4717ак»,
 * а «Неля Прокопчук» = «Прокопчук Неля» = «Прокопчук Н. В.» (збіг за прізвищем).
 */
export function queryKeys(s: string): string[] {
  const w = queryWords(s);
  if (!w.length) return [];
  return [...new Set([w.join(''), [...w].sort().join('')])];
}

/** Основний ключ запиту (для тестів і відлагодження). */
export const normalizeQuery = (s: string) => queryKeys(s)[0] ?? '';
