// Кілька телефонів однієї команди без сервера: пристрій передає журнал дій (посиланням або QR),
// інший зливає журнали й заново програє гру. Запечатані конверти відкриваються тими самими відповідями.
import type { CaseBundle, Level, Mode } from '../../../shared/case-types.ts';
import { openSealed } from '../../../shared/seal.ts';
import { reduce } from './reducer.ts';
import { MAX_HINTS, type Action, type GameState, type LogEntry, type LoggedAction } from './state.ts';

export type SyncData = { v: 1; caseId: string; id: string; level: Level; mode: Mode; team: string; startedAt: number; short?: boolean; log: LogEntry[] };

export const toSyncData = (s: GameState): SyncData => ({
  v: 1,
  caseId: s.caseId,
  id: s.id,
  level: s.level,
  mode: s.mode,
  team: s.team,
  startedAt: s.startedAt,
  ...(s.short ? { short: true } : {}),
  log: s.log,
});

export const sameGame = (s: GameState, d: SyncData) => s.caseId === d.caseId && s.id === d.id && s.level === d.level;

const keyOf = (a: LoggedAction): string => {
  switch (a.type) {
    case 'decide':
      return `d:${a.decision}`;
    case 'interview':
      return `${a.trigger ? 't' : 'i'}:${a.id}`;
    case 'hint':
      return `h:${a.task}:${a.n}`;
    case 'solved':
      return `s:${a.task}`;
    case 'code':
      return `c:${a.code}`;
    case 'accuse':
      return 'a';
    case 'penalty':
      return `p:${a.reason}`;
  }
};

/** Об'єднання журналів: кожна дія один раз, за часом; з двох однакових лишається раніша. */
export function mergeLogs(a: LogEntry[], b: LogEntry[]): LogEntry[] {
  const seen = new Set<string>();
  return [...a, ...b]
    .sort((x, y) => x.at - y.at)
    .filter((e) => {
      const k = keyOf(e.a);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

function toAction(e: LogEntry, payloads: Record<string, unknown>): Action {
  const now = e.at;
  const a = e.a;
  switch (a.type) {
    case 'decide':
      return { type: 'decide', decision: a.decision, option: a.option, now };
    case 'interview':
      return { type: 'interview', id: a.id, now, ...(a.trigger ? { triggerOnly: true } : {}) };
    case 'hint':
      return { type: 'hint', task: a.task, now };
    case 'solved':
      return { type: 'solved', task: a.task, canon: a.canon, payload: payloads[a.task], now };
    case 'code':
      return { type: 'code', code: a.code, now };
    case 'accuse':
      return { type: 'accuse', answers: a.answers, correct: a.correct, now };
    case 'penalty':
      return { type: 'penalty', min: a.min, reason: a.reason, now };
  }
}

/** Гра з нуля за журналом. Задачу-шлюз, конверт якої відповідь не відкриває, пропускаємо. */
export async function replayGame(bundle: CaseBundle, d: SyncData, now: number): Promise<GameState> {
  const payloads: Record<string, unknown> = {};
  const skip = new Set<LogEntry>();
  for (const e of d.log) {
    if (e.a.type !== 'solved') continue;
    const gate = bundle.tasks.find((t) => t.id === (e.a as { task: string }).task)?.gate;
    if (!gate) continue;
    const sealed = bundle.gates[gate]?.sealed[d.level];
    const payload = sealed ? await openSealed(sealed, e.a.canon) : null;
    if (payload === null) skip.add(e);
    else payloads[e.a.task] = payload;
  }
  // Рішення, які гравці ухвалили самі (на будь-якому телефоні), слідча за них не ухвалює.
  const reserved = [...new Set(d.log.flatMap((e) => (e.a.type === 'decide' ? [e.a.decision] : [])))];
  let s: GameState = { ...reduce(bundle, null, { type: 'start', level: d.level, mode: d.mode, team: d.team, now: d.startedAt, id: d.id, short: d.short })!, startedAt: d.startedAt, reserved };
  for (const e of [...d.log].sort((x, y) => x.at - y.at)) {
    if (skip.has(e)) continue;
    s = reduce(bundle, s, toAction(e, payloads))!;
  }
  const { reserved: _r, ...done } = reduce(bundle, s, { type: 'tick', now })!;
  return done;
}

/** Зливає чужий журнал у свою гру. Прочитані повідомлення й паузи після помилок лишаються свої. */
export async function mergeGame(bundle: CaseBundle, local: GameState, remote: SyncData, now: number): Promise<GameState> {
  const merged = await replayGame(bundle, { ...toSyncData(local), log: mergeLogs(local.log, remote.log) }, now);
  const read = new Set(local.inbox.filter((m) => m.read).map((m) => m.messageId ?? m.text));
  return {
    ...merged,
    inbox: merged.inbox.map((m) => (read.has(m.messageId ?? m.text) ? { ...m, read: true } : m)),
    wrong: local.wrong,
  };
}

// ---------- упаковка в посилання ----------

type Packed = [1, string, string, 't' | 'd', 'c' | 'd', string, number, unknown[][], (0 | 1)?];

function packEntry(e: LogEntry, startedAt: number): unknown[] {
  const t = Math.round((e.at - startedAt) / 1000);
  const a = e.a;
  switch (a.type) {
    case 'decide':
      return [t, 'd', a.decision, a.option];
    case 'interview':
      return [t, a.trigger ? 'I' : 'i', a.id];
    case 'hint':
      return [t, 'h', a.task, a.n];
    case 'solved':
      return [t, 's', a.task, a.canon];
    case 'code':
      return [t, 'c', a.code];
    case 'accuse':
      return [t, 'a', a.answers, a.correct];
    case 'penalty':
      return [t, 'p', a.min, a.reason];
  }
}

// Посилання — чужі дані: перевіряємо кожне поле, щоб зламане чи навмисне посилання не зіпсувало гру.
const MAX_CODE = 12_000;
const MAX_JSON = 64_000;
const MAX_ENTRIES = 400;
const MAX_GAME_SEC = 24 * 3600;
const isId = (v: unknown, max = 40): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const isRecord = (v: unknown, of: (x: unknown) => boolean) =>
  !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length <= 10 && Object.entries(v).every(([k, x]) => isId(k) && of(x));

function unpackEntry(p: unknown, startedAt: number): LogEntry | null {
  if (!Array.isArray(p)) return null;
  const [t, k, x, y] = p as unknown[];
  if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > MAX_GAME_SEC) return null;
  const at = startedAt + t * 1000;
  const a: LoggedAction | null =
    k === 'd' && isId(x) && isId(y) ? { type: 'decide', decision: x, option: y }
    : k === 'i' && isId(x) ? { type: 'interview', id: x }
    : k === 'I' && isId(x) ? { type: 'interview', id: x, trigger: true }
    : k === 'h' && isId(x) && Number.isInteger(y) && (y as number) >= 1 && (y as number) <= MAX_HINTS ? { type: 'hint', task: x, n: y as number }
    : k === 's' && isId(x) && isId(y) ? { type: 'solved', task: x, canon: y }
    : k === 'c' && Number.isInteger(x) && (x as number) >= 0 && (x as number) < 10_000 ? { type: 'code', code: x as number }
    : k === 'a' && isRecord(x, (v) => isId(v)) && isRecord(y, (v) => typeof v === 'boolean') ? { type: 'accuse', answers: x as Record<string, string>, correct: y as Record<string, boolean> }
    : k === 'p' && typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 60 && typeof y === 'string' && /^gate:[A-Z]$/.test(y) ? { type: 'penalty', min: x, reason: y }
    : null;
  return a && { at, a };
}

/** Пропускає байти крізь (роз)пакувальник; більше за `limit` байтів — помилка (захист від «бомби»). */
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit = Infinity): Promise<Uint8Array> {
  const reader = new Response(bytes as BodyInit).body!.pipeThrough(stream as unknown as TransformStream<Uint8Array, Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      void reader.cancel();
      throw new Error('too big');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

const toB64url = (b: Uint8Array) => btoa(Array.from(b, (c) => String.fromCharCode(c)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function encodeGame(d: SyncData): Promise<string> {
  const startSec = Math.round(d.startedAt / 1000);
  const packed: Packed = [1, d.caseId, d.id, d.level === 'trainee' ? 't' : 'd', d.mode === 'competition' ? 'c' : 'd', d.team, startSec, d.log.map((e) => packEntry(e, startSec * 1000)), d.short ? 1 : 0];
  return toB64url(await pipe(new TextEncoder().encode(JSON.stringify(packed)), new CompressionStream('deflate-raw')));
}

export async function decodeGame(code: string): Promise<SyncData | null> {
  try {
    if (code.length > MAX_CODE || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
    const json = new TextDecoder().decode(await pipe(fromB64url(code), new DecompressionStream('deflate-raw'), MAX_JSON));
    const [v, caseId, id, l, m, team, startSec, entries, short] = JSON.parse(json) as Packed;
    if (v !== 1 || !isId(caseId) || !isId(id) || (l !== 't' && l !== 'd') || (m !== 'c' && m !== 'd') || !isId(team) || !Number.isFinite(startSec)) return null;
    if (!Array.isArray(entries) || entries.length > MAX_ENTRIES) return null;
    const startedAt = startSec * 1000;
    const log = entries.map((p) => unpackEntry(p, startedAt));
    if (log.some((e) => !e)) return null;
    return { v: 1, caseId, id, level: l === 't' ? 'trainee' : 'detective', mode: m === 'c' ? 'competition' : 'departments', team, startedAt, ...(short ? { short: true } : {}), log: log as LogEntry[] };
  } catch {
    return null;
  }
}
