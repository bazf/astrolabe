// Паперова партія на 40 хв: збирає з YAML справи й накладки paper40.yaml один відкритий JSON
// (усі «@ключі» розгорнуто, таблиці розв'язувача підставлено) для друкованих сторінок.
// Запуск: node --experimental-strip-types tools/paper/content.ts
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
// @ts-expect-error — JS-модуль без типів
import { solveAll } from '../solve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = join(root, 'content/cases/astrolabe');
type Any = Record<string, any>;

const LIST_KEYS = ['docs', 'tasks', 'decisions', 'events', 'codes', 'interviews', 'db', 'accusation'];

/** Основна справа у відкритому вигляді (як у handoff/export-plain.mjs). */
export function loadPlainCase(): { plain: Any; strings: Record<string, string>; resolve: (n: unknown) => any } {
  const src: Any = parse(readFileSync(join(dir, 'case.yaml'), 'utf8'));
  for (const f of readdirSync(join(dir, 'acts')).filter((f) => f.endsWith('.yaml')).sort()) {
    const act: Any = parse(readFileSync(join(dir, 'acts', f), 'utf8'));
    for (const k of LIST_KEYS) if (act[k]) src[k] = [...(src[k] ?? []), ...act[k]];
    if (act.gates) src.gates = { ...src.gates, ...act.gates };
    if (act.accusationOpen) src.accusationOpen = act.accusationOpen;
  }
  const flatten = (obj: unknown, prefix = '', out: Record<string, string> = {}) => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
    else if (typeof obj === 'string' || typeof obj === 'number') out[prefix] = String(obj);
    return out;
  };
  const strings: Record<string, string> = {};
  for (const f of readdirSync(join(dir, 'uk')).filter((f) => f.endsWith('.yaml')).sort()) Object.assign(strings, flatten(parse(readFileSync(join(dir, 'uk', f), 'utf8'))));

  const comma = (v: unknown) => String(v).replace('.', ',');
  const inWindows = (t: string) => (t >= '08:00' && t <= '11:00') || (t >= '15:00' && t <= '18:30');
  const solved = solveAll();
  const sunTable = solved.shadow.table.filter((r: Any) => inWindows(r.time));
  const tables: Record<string, unknown> = {
    '$solve:cipherTrainee': solved.cipher.trainee,
    '$solve:cipherDetective': solved.cipher.detective,
    '$solve:sunRatio': sunTable.map((r: Any) => [r.time, comma(r.shadowToHeight.toFixed(2))]),
    '$solve:sunAltitude': sunTable.map((r: Any) => [r.time, comma(r.altitudeDeg.toFixed(1))]),
  };
  const missing = new Set<string>();
  const resolve = (n: unknown): any => {
    if (typeof n === 'string') {
      if (n.startsWith('$solve:')) {
        if (!(n in tables)) missing.add(n);
        return tables[n];
      }
      if (n.startsWith('@')) {
        const v = strings[n.slice(1)];
        if (v === undefined) missing.add(n);
        return v ?? n;
      }
      return n;
    }
    if (Array.isArray(n)) return n.map(resolve);
    if (n && typeof n === 'object') return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, resolve(v)]));
    return n;
  };
  const plain = resolve(src);
  if (missing.size) throw new Error(`Не знайдено: ${[...missing].join(', ')}`);
  return { plain, strings, resolve };
}

const stripKeys = (n: unknown, keys: string[]): any => {
  if (Array.isArray(n)) return n.map((x) => stripKeys(x, keys));
  if (n && typeof n === 'object') return Object.fromEntries(Object.entries(n).filter(([k]) => !keys.includes(k)).map(([k, v]) => [k, stripKeys(v, keys)]));
  return n;
};

export function buildPaper() {
  const { plain, strings, resolve } = loadPlainCase();
  const raw: Any = parse(readFileSync(join(dir, 'paper40.yaml'), 'utf8'));
  // «$doc:<id>.<level>.<prop>» — взяти властивість з основного документа
  const fromDoc = (n: unknown): any => {
    if (typeof n === 'string' && n.startsWith('$doc:')) {
      const [id, level, prop] = n.slice(5).split('.');
      const d = plain.docs.find((x: Any) => x.id === id);
      const v = d?.levels?.[level]?.[prop];
      if (v === undefined) throw new Error(`Немає ${n}`);
      return v;
    }
    if (Array.isArray(n)) return n.map(fromDoc);
    if (n && typeof n === 'object') return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, fromDoc(v)]));
    return n;
  };
  const cfg: Any = fromDoc(resolve(raw));

  const overrides = new Map<string, Any>(cfg.docs.map((d: Any) => [d.id, d]));
  const docById = (id: string): Any => {
    const base = plain.docs.find((x: Any) => x.id === id);
    const o = overrides.get(id);
    if (!base && !o?.component) throw new Error(`Документ ${id} не знайдено`);
    let doc: Any = base ? structuredClone(base) : { id, label: o!.label, title: o!.title, component: o!.component, props: {}, dept: o!.dept };
    if (o) {
      doc = { ...doc, ...(o.title ? { title: o.title } : {}), ...(o.label ? { label: o.label } : {}), ...(o.dept ? { dept: o.dept } : {}), ...(o.component ? { component: o.component } : {}) };
      doc.props = { ...doc.props, ...(o.props ?? {}) };
      if (o.levels) doc.levels = o.levels;
      if (o.strip) doc.props = stripKeys(doc.props, o.strip);
    }
    // На папері QR і коди АС-### не потрібні.
    doc.props = stripKeys(doc.props, ['code', 'codeCaption']);
    doc.medium = 'paper';
    return doc;
  };

  let sheetNo = 0;
  const envelopes = cfg.envelopes.map((e: Any) => ({
    id: e.id,
    label: e.label,
    title: e.title,
    note: e.note,
    sheets: e.sheets.map((ids: string[]) => ({ number: ++sheetNo, docs: ids.map(docById) })),
  }));
  const outcomeDocs = cfg.outcomeDocs.map(docById);

  const taskOv: Any = cfg.taskOverrides ?? {};
  const tasks = cfg.tasks.map((k: Any) => {
    const t = structuredClone(plain.tasks.find((x: Any) => x.id === k.id));
    if (!t) throw new Error(`Завдання ${k.id} не знайдено`);
    const o = taskOv[k.id];
    if (o?.hints) for (const lv of ['trainee', 'detective']) (o.hints[lv] ?? []).forEach((h: string, i: number) => (t.hints[lv][i] = h));
    return { ...t, act: k.act, branch: !!k.branch };
  });

  const decisions = cfg.decisions.map((d: Any) => {
    const base = plain.decisions.find((x: Any) => x.id === d.id);
    if (!base) throw new Error(`Рішення ${d.id} не знайдено`);
    return {
      id: d.id,
      label: base.label,
      prompt: base.prompt,
      context: base.context,
      given: d.given,
      deadline: d.deadline,
      default: d.default,
      options: base.options
        .filter((o: Any) => d.options[o.id] !== undefined)
        .map((o: Any) => ({ id: o.id, label: o.label, ...(d.options[o.id] ?? {}) })),
    };
  });

  const events = cfg.events.map((e: Any) => {
    const base = plain.events.find((x: Any) => x.id === e.id);
    return { ...e, decision: base?.decision };
  });

  const epi = Object.fromEntries(Object.entries(strings).filter(([k]) => k.startsWith('epi.')).map(([k, v]) => [k.slice(4), v]));

  const out = {
    title: cfg.title,
    subtitle: cfg.subtitle,
    durationMin: cfg.durationMin,
    hintPenaltyMin: cfg.hintPenaltyMin,
    gatePenaltyMin: cfg.gatePenaltyMin,
    wrongRule: cfg.wrongRule,
    envelopes,
    outcomeDocs,
    tasks,
    gates: cfg.gates,
    events,
    decisions,
    timeline: cfg.timeline,
    checkpoints: cfg.checkpoints,
    host: cfg.host,
    rules: cfg.rules,
    accusation: plain.accusation,
    interviews: plain.interviews,
    db: plain.db,
    epi,
    caseTitle: strings['case.title'],
  };
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = buildPaper();
  const file = join(root, 'app/src/generated/paper40.json');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(out, null, 1));
  const sheets = out.envelopes.reduce((a: number, e: Any) => a + e.sheets.length, 0);
  console.log(`paper40.json: ${sheets} аркушів у ${out.envelopes.length} конвертах, ${out.tasks.length} завдань, ${out.decisions.length} рішень, ${out.events.length} подій`);
}
