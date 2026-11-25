// Чисті функції інструмента сліпого проходження (tools/blind/play.ts).
import type { CaseDoc, Section } from '../../shared/case-types.ts';

const DIRS: Record<Section, string> = { start: '00-старт', A: '01-конверт-А', B: '02-конверт-Б', C: '03-конверт-В', D: '04-конверт-Г' };
const ORDER: Section[] = ['start', 'A', 'B', 'C', 'D'];

export const envelopeDir = (s: Section) => DIRS[s];

/** Аркуш → конверт, у якому він лежить. Аркуш із документами двох конвертів — помилка розкладки. */
export function sheetSections(docs: Pick<CaseDoc, 'medium' | 'sheet' | 'section'>[]): Map<number, Section> {
  const m = new Map<number, Section>();
  for (const d of docs) {
    if (d.medium !== 'paper' || !d.sheet) continue;
    const was = m.get(d.sheet);
    if (was && was !== d.section) throw new Error(`аркуш ${d.sheet}: документи конвертів ${was} і ${d.section}`);
    m.set(d.sheet, d.section);
  }
  return new Map([...m.entries()].sort((a, b) => a[0] - b[0]));
}

/** Які конверти команда вже має право відкрити — за станом активної гри у сховищі застосунку. */
export function openSections(boardJson: string | null): Section[] {
  try {
    const b = JSON.parse(boardJson ?? 'null') as { games?: { id: string; gatePayloads?: Record<string, unknown> }[]; active?: string } | null;
    const g = b?.games?.find((x) => x.id === b.active);
    if (!g) return [];
    const gates = Object.keys(g.gatePayloads ?? {});
    return ORDER.filter((s) => s === 'start' || gates.includes(s));
  } catch {
    return [];
  }
}

/** Аркуші відкритих конвертів, яких команда ще не отримала. */
export function toRevealSheets(sheets: Map<number, Section>, open: Section[], revealed: number[]): number[] {
  return [...sheets.entries()].filter(([n, s]) => open.includes(s) && !revealed.includes(n)).map(([n]) => n);
}

export function distanceMm(a: [number, number], b: [number, number], pxPerMm: number): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]) / pxPerMm;
}
