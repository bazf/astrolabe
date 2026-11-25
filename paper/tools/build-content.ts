// Збирає справу з YAML у app/src/generated/case.json.
// Відповіді → хеші, вміст за шлюзами → запечатаний, тексти → обфусковані.
// Запуск: npm run content
import { hostCode } from './print-config.ts';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { acceptedForCheck, canonForCheck, checkKindOf, queryKeys, type AnswerSpec } from '../shared/answers.ts';
import { hashAnswer, obfuscate, sealWithAnswers, sealWithSecret, SHORT_GAME_KEY } from '../shared/seal.ts';
import type { AccusationBuilt, CaseBundle, CaseSource, DbBuilt, Effect, GateId, GatePayload, Geometry, HostData, Level, TaskBuilt } from '../shared/case-types.ts';
// @ts-expect-error — JS-модуль без типів
import { solveAll } from './solve.mjs';

const comma = (v: number | string) => String(v).replace('.', ',');
const inWindows = (time: string) => (time >= '08:00' && time <= '11:00') || (time >= '15:00' && time <= '18:30');

/** Таблиці, які друкуються з розв'язувача, а не вписуються вручну. */
function solverTables(): Record<string, unknown> {
  const solved = solveAll();
  const table = (solved.shadow.table as { time: string; altitudeDeg: number; shadowToHeight: number }[]).filter((r) => inWindows(r.time));
  return {
    '$solve:cipherTrainee': solved.cipher.trainee,
    '$solve:cipherDetective': solved.cipher.detective,
    '$solve:sunRatio': table.map((r) => [r.time, comma(r.shadowToHeight.toFixed(2))]),
    '$solve:sunAltitude': table.map((r) => [r.time, comma(r.altitudeDeg.toFixed(1))]),
  };
}

function injectSolver(node: unknown, tables: Record<string, unknown>): unknown {
  if (typeof node === 'string' && node.startsWith('$solve:')) {
    if (!(node in tables)) throw new Error(`Невідома таблиця розв'язувача ${node}`);
    return tables[node];
  }
  if (Array.isArray(node)) return node.map((n) => injectSolver(n, tables));
  if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, injectSolver(v, tables)]));
  return node;
}

const LEVELS: Level[] = ['trainee', 'detective'];

function flatten(obj: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (typeof obj === 'string') out[prefix] = obj;
  else if (typeof obj === 'number') out[prefix] = String(obj);
  return out;
}

function loadStrings(dir: string): Record<string, string> {
  const ukDir = join(dir, 'uk');
  const out: Record<string, string> = {};
  for (const f of readdirSync(ukDir).filter((f) => f.endsWith('.yaml')).sort()) {
    const flat = flatten(parse(readFileSync(join(ukDir, f), 'utf8')));
    for (const [k, v] of Object.entries(flat)) {
      if (k in out) throw new Error(`Дубль ключа тексту «${k}» у ${f}`);
      out[k] = v;
    }
  }
  return out;
}

/** Усі рядки виду «@ключ» у структурі. */
function collectRefs(node: unknown, acc = new Set<string>()): Set<string> {
  if (typeof node === 'string' && node.startsWith('@')) acc.add(node.slice(1));
  else if (Array.isArray(node)) node.forEach((n) => collectRefs(n, acc));
  else if (node && typeof node === 'object') Object.values(node).forEach((n) => collectRefs(n, acc));
  return acc;
}

const text = (strings: Record<string, string>, ref: string) => {
  const key = ref.startsWith('@') ? ref.slice(1) : ref;
  const v = strings[key];
  if (v === undefined) throw new Error(`Немає тексту «${key}»`);
  return v;
};

const LIST_KEYS = ['docs', 'tasks', 'decisions', 'events', 'codes', 'interviews', 'db', 'accusation'] as const;

/** case.yaml + acts/*.yaml: масиви доповнюються, шлюзи зливаються. */
function loadSource(dir: string): CaseSource {
  const src = parse(readFileSync(join(dir, 'case.yaml'), 'utf8')) as CaseSource;
  const actsDir = join(dir, 'acts');
  const acts = existsSync(actsDir) ? readdirSync(actsDir).filter((f) => f.endsWith('.yaml')).sort() : [];
  for (const f of acts) {
    const act = parse(readFileSync(join(actsDir, f), 'utf8')) as Partial<CaseSource>;
    for (const k of LIST_KEYS) if (act[k]) (src as unknown as Record<string, unknown[]>)[k] = [...((src[k] as unknown[]) ?? []), ...(act[k] as unknown[])];
    if (act.gates) src.gates = { ...src.gates, ...act.gates };
    if (act.accusationOpen) src.accusationOpen = act.accusationOpen;
  }
  return src;
}

function hostAnswer(spec: AnswerSpec, unit?: string): string {
  if (spec.kind === 'number') return (spec.min === spec.max ? comma(spec.min) : `${comma(spec.min)}–${comma(spec.max)}`) + (unit ? ` ${unit}` : '');
  if (spec.kind === 'time') return spec.min === spec.max ? spec.min : `${spec.min}–${spec.max}`;
  return Object.values(spec.options)[0][0];
}

/** Усі повідомлення ефектів, з обох гілок умовних. */
function effectMessages(effects: Effect[] = []): string[] {
  return effects.flatMap((e) => ('message' in e ? [e.message] : 'if' in e ? [...effectMessages(e.then), ...effectMessages(e.else)] : []));
}

/** Дані пульта ведучого — відкритим текстом; збирання їх шифрує. */
function hostData(src: CaseSource, strings: Record<string, string>): HostData {
  const tx = (ref: string) => text(strings, ref);
  const tl = Object.keys(strings)
    .filter((k) => /^host\.timeline\.[^.]+\.when$/.test(k))
    .map((k) => k.split('.')[2]);
  return {
    intro: tx('host.intro'),
    timeline: tl.map((id) => ({ when: tx(`host.timeline.${id}.when`), stage: tx(`host.timeline.${id}.stage`), what: tx(`host.timeline.${id}.what`), give: tx(`host.timeline.${id}.give`) })),
    notes: {
      short: tx('host.short'),
      departments: tx('host.departments'),
      stuck: tx('host.stuck'),
      briefing: tx('host.briefing'),
      prep: tx('host.prep'),
      scoring: tx('host.scoring'),
      solution: tx('host.solution'),
    },
    tasks: src.tasks.map((t) => ({
      id: t.id,
      label: t.label,
      title: tx(t.title),
      gate: t.gate,
      optional: !!t.optional,
      depts: t.depts ?? [],
      levels: Object.fromEntries(
        LEVELS.map((l) => [l, { question: tx(t.question[l]), answer: hostAnswer(t.spec[l], t.unit), canon: acceptedForCheck(t.spec[l])[0], solution: tx(t.hints[l][2]) }]),
      ) as HostData['tasks'][number]['levels'],
    })),
    decisions: src.decisions.map((d) => ({
      id: d.id,
      label: d.label,
      prompt: tx(d.prompt),
      deadline: d.deadlineGate,
      defaultOption: d.defaultOption,
      options: d.options.map((o) => ({ id: o.id, label: tx(o.label), after: effectMessages(o.effects).map(tx) })),
    })),
    accusation: (src.accusation ?? []).map((q) => ({ prompt: tx(q.prompt), answer: tx(q.options.find((o) => o.id === q.answer)?.label ?? q.answer) })),
  };
}

export async function buildCase(dir: string): Promise<CaseBundle> {
  const src = loadSource(dir);
  src.docs = injectSolver(src.docs, solverTables()) as CaseSource['docs'];
  const geometry = parse(readFileSync(join(dir, 'geometry.yaml'), 'utf8')) as Geometry;
  const strings = loadStrings(dir);

  const tasks: TaskBuilt[] = [];
  for (const t of src.tasks) {
    const { spec, ...rest } = t;
    const check = {} as TaskBuilt['check'];
    for (const level of LEVELS) {
      const salt = `${src.id}:${t.id}:${level}`;
      const hashes = await Promise.all(acceptedForCheck(spec[level]).map((c) => hashAnswer(salt, c)));
      check[level] = { ...checkKindOf(spec[level]), salt, hashes };
    }
    tasks.push({ ...rest, check });
  }

  const gates: CaseBundle['gates'] = {};
  for (const [gate, g] of Object.entries(src.gates ?? {}) as [GateId, NonNullable<CaseSource['gates'][GateId]>][]) {
    const task = src.tasks.find((t) => t.id === g.task);
    if (!task) throw new Error(`Шлюз ${gate}: немає завдання ${g.task}`);
    const payload: GatePayload = { envelope: gate, message: text(strings, g.payload.message), unlock: g.payload.unlock };
    const sealed = {} as Record<Level, Awaited<ReturnType<typeof sealWithAnswers>>>;
    // Шлюз скороченої партії відкривається ще й її ключем — ведучий видає цей акт розкритим.
    const extra = src.short?.gate === gate ? [SHORT_GAME_KEY] : [];
    for (const level of LEVELS) sealed[level] = await sealWithAnswers(payload, `${src.id}:gate:${gate}:${level}`, [...acceptedForCheck(task.spec[level]), ...extra]);
    gates[gate] = { task: g.task, sealed };
  }

  // Пульт ведучого — лише зашифрований кодом ведучого; його тексти у відкриту збірку не йдуть.
  let host: CaseBundle['host'];
  if (src.host) {
    const code = canonForCheck({ kind: 'text' }, hostCode(process.env, src.host.code));
    if (!code) throw new Error('Порожній код ведучого');
    host = { sealed: await sealWithSecret(hostData(src, strings), `${src.id}:host`, code), gatePenaltyMin: src.host.gatePenaltyMin };
  }

  const obf: Record<string, string> = {};
  for (const [k, v] of Object.entries(strings)) if (!k.startsWith('host.')) obf[k] = obfuscate(v);

  const dbSalt = `${src.id}:db`;
  const db: DbBuilt[] = [];
  for (const e of src.db ?? []) {
    const keys = [...new Set(e.keys.flatMap((k) => queryKeys(String(k))))];
    db.push({ hashes: await Promise.all(keys.map((k) => hashAnswer(dbSalt, k))), title: e.title, body: e.body });
  }

  const accusation: AccusationBuilt[] = [];
  for (const q of src.accusation ?? []) {
    const { answer, ...restQ } = q;
    if (!q.options.some((o) => o.id === answer)) throw new Error(`Звинувачення ${q.id}: правильної відповіді ${answer} немає серед варіантів`);
    const salt = `${src.id}:accuse:${q.id}`;
    // Абетка замість порядку з YAML: правильна відповідь не стоїть першою.
    const label = (ref: string) => strings[ref.slice(1)] ?? ref;
    const options = [...q.options].sort((a, b) => label(a.label).localeCompare(label(b.label), 'uk'));
    accusation.push({ ...restQ, options, salt, answerHash: await hashAnswer(salt, answer) });
  }

  const { gates: _g, tasks: _t, db: _d, accusation: _a, host: _h, ...rest } = src;
  const bundle: CaseBundle = { ...rest, tasks, gates, geometry, strings: obf, db, dbSalt, accusation, ...(host ? { host } : {}) };
  // Тексти шлюзів живуть лише всередині запечатаного вмісту.
  for (const g of Object.values(src.gates ?? {})) if (g) delete bundle.strings[g.payload.message.slice(1)];
  return bundle;
}

export function validateCase(b: CaseBundle): string[] {
  const errors: string[] = [];
  const docIds = new Set<string>();
  for (const d of b.docs) {
    if (docIds.has(d.id)) errors.push(`Дубль документа ${d.id}`);
    docIds.add(d.id);
    if (d.medium === 'paper' && (!d.sheet || d.sheet < 1 || d.sheet > 25)) errors.push(`Документ ${d.id}: паперовий без аркуша 1–25`);
  }
  // аркуш лежить в одному конверті — інакше посібник ведучого поклав би його не туди
  const sheetSection = new Map<number, string>();
  for (const d of b.docs) {
    if (d.medium !== 'paper' || !d.sheet) continue;
    const was = sheetSection.get(d.sheet);
    if (was && was !== d.section) errors.push(`Аркуш ${d.sheet}: документи двох конвертів (${was} і ${d.section})`);
    else sheetSection.set(d.sheet, d.section);
  }
  const eventIds = new Set(b.events.map((e) => e.id));
  const decisionIds = new Set(b.decisions.map((d) => d.id));
  const taskIds = new Set(b.tasks.map((t) => t.id));
  const interviewIds = new Set(b.interviews.map((i) => i.id));

  const checkEffects = (where: string, effects: Effect[] = []): void => {
    for (const e of effects) {
      if ('if' in e) {
        checkEffects(`${where} (якщо)`, e.then);
        checkEffects(`${where} (інакше)`, e.else ?? []);
        continue;
      }
      if ('unlock' in e && !e.unlock.startsWith('section:') && !docIds.has(e.unlock)) errors.push(`${where}: unlock невідомого документа ${e.unlock}`);
      if ('schedule' in e && !eventIds.has(e.schedule)) errors.push(`${where}: schedule невідомої події ${e.schedule}`);
      if ('clearLock' in e && !taskIds.has(e.clearLock)) errors.push(`${where}: clearLock невідомого завдання ${e.clearLock}`);
    }
  };
  for (const d of b.decisions) {
    for (const o of d.options) checkEffects(`Рішення ${d.id}/${o.id}`, o.effects);
    if (d.defaultOption && !d.options.some((o) => o.id === d.defaultOption)) errors.push(`Рішення ${d.id}: немає варіанта за замовчуванням ${d.defaultOption}`);
  }
  for (const e of b.events) {
    checkEffects(`Подія ${e.id}`, e.effects);
    if (e.decision && !decisionIds.has(e.decision)) errors.push(`Подія ${e.id}: невідоме рішення ${e.decision}`);
  }
  for (const c of b.codes) {
    const a = c.action;
    if ('interview' in a && !interviewIds.has(a.interview)) errors.push(`Код ${c.code}: невідомий допит ${a.interview}`);
    if ('decision' in a && !decisionIds.has(a.decision)) errors.push(`Код ${c.code}: невідоме рішення ${a.decision}`);
    if ('task' in a && !taskIds.has(a.task)) errors.push(`Код ${c.code}: невідоме завдання ${a.task}`);
    if ('doc' in a && !docIds.has(a.doc)) errors.push(`Код ${c.code}: невідомий документ ${a.doc}`);
  }
  for (const i of b.interviews) if (!docIds.has(i.doc)) errors.push(`Допит ${i.id}: немає документа ${i.doc}`);
  for (const t of b.tasks) checkEffects(`Завдання ${t.id}`, t.effects);
  for (const [gate, g] of Object.entries(b.gates)) if (g && !taskIds.has(g.task)) errors.push(`Шлюз ${gate}: немає завдання ${g.task}`);
  if (b.short) {
    if (!b.gates[b.short.gate]) errors.push(`Скорочена партія: немає шлюзу ${b.short.gate}`);
    for (const [d, o] of Object.entries(b.short.decide)) {
      const dec = b.decisions.find((x) => x.id === d);
      if (!dec) errors.push(`Скорочена партія: невідоме рішення ${d}`);
      else if (!dec.options.some((x) => x.id === o)) errors.push(`Скорочена партія: немає варіанта ${d}/${o}`);
    }
    for (const t of b.short.optional) if (!taskIds.has(t)) errors.push(`Скорочена партія: невідоме завдання ${t}`);
  }

  const { strings, ...structure } = b;
  for (const ref of collectRefs(structure)) if (!(ref in strings)) errors.push(`Немає тексту «${ref}»`);
  return errors;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const bundle = await buildCase(join(root, 'content/cases/astrolabe'));
  const errors = validateCase(bundle);
  if (errors.length) {
    console.error(`Помилки у справі:\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  const out = join(root, 'app/src/generated/case.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(bundle));
  console.log(`case.json: ${bundle.docs.length} документів, ${bundle.tasks.length} завдань, ${Object.keys(bundle.strings).length} текстів`);
}
