import type { CaseDoc, Dept, Section } from '../../../shared/case-types.ts';

export type SheetKind = 'labels' | 'full' | 'photos' | 'cards' | 'halves';
export type SheetPlan = { number: number; kind: SheetKind; docs: CaseDoc[] };

function kindOf(docs: CaseDoc[]): SheetKind {
  if (docs.some((d) => d.component === 'Cover')) return 'labels';
  if (docs.length === 1) return 'full';
  if (docs.every((d) => d.component === 'PhotoPrint')) return 'photos';
  if (docs.some((d) => d.component === 'DossierCards')) return 'cards';
  return 'halves';
}

/** Паперові документи → аркуші А4 у порядку номерів; всередині аркуша — порядок маніфесту. */
export function planSheets(docs: CaseDoc[]): SheetPlan[] {
  const bySheet = new Map<number, CaseDoc[]>();
  for (const d of docs) {
    if (d.medium !== 'paper' || !d.sheet) continue;
    bySheet.set(d.sheet, [...(bySheet.get(d.sheet) ?? []), d]);
  }
  return [...bySheet.entries()].sort((a, b) => a[0] - b[0]).map(([number, list]) => ({ number, kind: kindOf(list), docs: list }));
}

const FOLDER = ['Cover', 'RulesCard', 'BriefingLetter', 'CipherDisk'];
const SECTIONS: Section[] = ['start', 'A', 'B', 'C', 'D'];

/** Номери аркушів одним рядком: 1–3, 5, 7–8. */
export function ranges(ns: number[]): string {
  const out: string[] = [];
  const sorted = [...ns].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    out.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j;
  }
  return out.join(', ');
}

/** Що класти в папку й у кожен конверт (для посібника ведучого). Папка — обкладинка, правила, лист, диск. */
export function envelopeSheets(plans: SheetPlan[]): { id: 'folder' | Section; sheets: number[] }[] {
  const folder = plans.filter((p) => p.docs.every((d) => FOLDER.includes(d.component))).map((p) => p.number);
  const rest = plans.filter((p) => !folder.includes(p.number));
  return [
    { id: 'folder' as const, sheets: folder },
    ...SECTIONS.map((s) => ({ id: s, sheets: rest.filter((p) => p.docs[0].section === s).map((p) => p.number) })),
  ].filter((e) => e.sheets.length > 0);
}

/** Розкладка для «Відділів»: паперові документи кожного відділу з номерами аркушів. */
export function deptSheets(plans: SheetPlan[]): Record<Dept, { sheet: number; doc: CaseDoc }[]> {
  const out: Record<Dept, { sheet: number; doc: CaseDoc }[]> = { K: [], A: [], O: [] };
  for (const p of plans) for (const d of p.docs) if (d.dept) out[d.dept].push({ sheet: p.number, doc: d });
  return out;
}
