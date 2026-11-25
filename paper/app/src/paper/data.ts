// Дані паперової партії (збирає tools/paper/content.ts) і «пакет» для компонентів документів.
import paperJson from '../generated/paper40.json';
import caseJson from '../generated/case.json';
import type { CaseBundle, CaseDoc, Dept, Level } from '../../../shared/case-types.ts';

export type Task = {
  id: string;
  label: string;
  title: string;
  question: Record<Level, string>;
  unit?: string;
  gate?: string;
  depts?: Dept[];
  act: number;
  branch: boolean;
  spec: Record<Level, { kind: string; min?: number | string; max?: number | string; step?: number; options?: Record<string, string[]> }>;
  hints: Record<Level, string[]>;
  onSolved?: string;
};
export type Sheet = { number: number; docs: CaseDoc[] };
export type Envelope = { id: string; label: string; title: string; note: string; sheets: Sheet[] };
export type Option = { id: string; label: string; after?: string; note?: string; give?: string[] };
export type Decision = { id: string; label: string; prompt: string; context?: string; given: string; deadline?: string; default?: string; options: Option[] };
export type GameEvent = { id: string; when: string; text: string; then: string; decision?: string };

export type Paper = {
  title: string;
  subtitle: string;
  durationMin: number;
  hintPenaltyMin: number;
  gatePenaltyMin: number;
  wrongRule: string;
  envelopes: Envelope[];
  outcomeDocs: CaseDoc[];
  tasks: Task[];
  gates: Record<string, { task: string; envelope: string; text: string }>;
  events: GameEvent[];
  decisions: Decision[];
  timeline: { when: string; stage: string; what: string; give: string }[];
  checkpoints: { gate: string; by: number }[];
  host: Record<string, string>;
  rules: { title: string; intro: string; sections: { title: string; body: string }[] };
  accusation: { id: string; prompt: string; answer: string; options: { id: string; label: string }[] }[];
  interviews: CaseBundle['interviews'];
  db: { title: string; body: string }[];
  epi: Record<string, string>;
  caseTitle: string;
};

export const paper = paperJson as unknown as Paper;

/** Пакет для DocProvider: тексти вже відкриті (t() повертає їх як є), геометрія карт — з case.json. */
export const bundle = {
  ...(caseJson as unknown as CaseBundle),
  strings: {},
  docs: [],
  tasks: paper.tasks,
  interviews: paper.interviews,
} as unknown as CaseBundle;

export const LEVELS: [Level, string][] = [
  ['trainee', 'Стажер'],
  ['detective', 'Слідчий'],
];
export const DEPT_NAMES: Record<Dept, string> = { K: 'Криміналісти', A: 'Аналітики', O: 'Оперативники' };
export const DEPT_LETTERS: Record<Dept, string> = { K: 'К', A: 'А', O: 'О' };

const comma = (v: unknown) => String(v).replace('.', ',');
/** Що приймати як правильну відповідь — для ведучого. */
export function acceptText(t: Task, level: Level): string {
  const s = t.spec[level];
  if (s.kind === 'number') {
    const range = s.min === s.max ? comma(s.min) : `від ${comma(s.min)} до ${comma(s.max)}`;
    return `${range}${t.unit ? ` ${t.unit}` : ''}`;
  }
  if (s.kind === 'time') return s.min === s.max ? String(s.min) : `від ${s.min} до ${s.max}`;
  return Object.values(s.options ?? {}).map((alts) => alts.join(' / ')).join('; ');
}

export const docLabel = (id: string) => {
  const all = [...paper.envelopes.flatMap((e) => e.sheets.flatMap((s) => s.docs)), ...paper.outcomeDocs];
  const d = all.find((x) => x.id === id);
  return d ? `${d.label} «${d.title}»` : id;
};
