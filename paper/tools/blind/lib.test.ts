import { describe, expect, it } from 'vitest';
import { distanceMm, envelopeDir, openSections, sheetSections, toRevealSheets } from './lib.ts';

const doc = (sheet: number, section: string, medium = 'paper') => ({ sheet, section, medium }) as never;

describe('сліпе проходження: аркуші й конверти', () => {
  it('кожен паперовий аркуш належить одному конверту', () => {
    const m = sheetSections([doc(1, 'start'), doc(1, 'start'), doc(13, 'A'), doc(24, 'D'), doc(0, 'B', 'app')]);
    expect([...m.entries()]).toEqual([
      [1, 'start'],
      [13, 'A'],
      [24, 'D'],
    ]);
  });

  it('аркуш з документами різних конвертів — помилка розкладки', () => {
    expect(() => sheetSections([doc(5, 'start'), doc(5, 'A')])).toThrow(/аркуш 5/);
  });

  it('тека конверта названа так, як підписано наклейку', () => {
    expect(envelopeDir('start')).toBe('00-старт');
    expect(envelopeDir('C')).toBe('03-конверт-В');
  });

  it('відкриті конверти беруться з активної гри у сховищі', () => {
    expect(openSections(null)).toEqual([]);
    expect(openSections('зіпсовано')).toEqual([]);
    const board = { games: [{ id: 'x', gatePayloads: {} }, { id: 'y', gatePayloads: { B: {}, A: {} } }], active: 'y' };
    expect(openSections(JSON.stringify(board))).toEqual(['start', 'A', 'B']);
  });

  it('видає лише ще не видані аркуші, по порядку', () => {
    const sheets = new Map<number, never>([[1, 'start'], [2, 'start'], [13, 'A'], [17, 'B']] as never);
    expect(toRevealSheets(sheets, ['start', 'A'], [1])).toEqual([2, 13]);
    expect(toRevealSheets(sheets, [], [])).toEqual([]);
  });

  it('лінійка: відстань у мм за масштабом зображення', () => {
    expect(distanceMm([0, 0], [30, 40], 5)).toBe(10);
  });
});
