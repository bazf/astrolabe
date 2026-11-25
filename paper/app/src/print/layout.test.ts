import { beforeAll, describe, expect, it } from 'vitest';
import { buildCase } from '../../../tools/build-content.ts';
import type { CaseBundle } from '../../../shared/case-types.ts';
import { planSheets } from './layout.ts';

let bundle: CaseBundle;
beforeAll(async () => {
  bundle = await buildCase('content/cases/astrolabe');
}, 60_000);

describe('planSheets', () => {
  it('lays out sheets 1–24 in order with the right layout kind', () => {
    const sheets = planSheets(bundle.docs);
    expect(sheets.map((s) => s.number)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    const kind = Object.fromEntries(sheets.map((s) => [s.number, s.kind]));
    expect(kind).toMatchObject({ 1: 'labels', 2: 'full', 3: 'full', 4: 'full', 5: 'photos', 6: 'photos', 7: 'halves', 8: 'halves', 9: 'full', 10: 'full', 11: 'cards', 12: 'full', 13: 'halves', 14: 'halves', 15: 'cards', 16: 'full', 17: 'halves', 18: 'photos', 19: 'cards', 20: 'full', 21: 'full', 22: 'halves', 23: 'full', 24: 'halves' });
  });

  it('keeps document order inside a sheet as in the manifest', () => {
    const s7 = planSheets(bundle.docs).find((s) => s.number === 7)!;
    expect(s7.docs.map((d) => d.id)).toEqual(['1-05', '1-08']);
  });

  it('never exceeds 25 sheets and ignores app-only documents', () => {
    const sheets = planSheets(bundle.docs);
    expect(sheets.length).toBeLessThanOrEqual(25);
    expect(sheets.flatMap((s) => s.docs).every((d) => d.medium === 'paper')).toBe(true);
  });
});
