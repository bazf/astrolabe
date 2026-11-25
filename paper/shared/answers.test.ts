import { describe, expect, it } from 'vitest';
import { acceptedCanon, normalizeAnswer, normalizeCode, type AnswerSpec } from './answers.ts';

describe('normalizeAnswer: number', () => {
  const spec: AnswerSpec = { kind: 'number', min: 1.6, max: 1.9, step: 0.1 };

  it('accepts comma, units and rounding to step', () => {
    expect(normalizeAnswer(spec, '1,8')).toBe('1.8');
    expect(normalizeAnswer(spec, '1.8 м/с')).toBe('1.8');
    expect(normalizeAnswer(spec, ' 1.75')).toBe('1.8');
  });

  it('normalizes out-of-range numbers without accepting them', () => {
    expect(normalizeAnswer(spec, '18')).toBe('18');
    expect(acceptedCanon(spec)).not.toContain('18');
  });

  it('rejects non-numbers', () => {
    expect(normalizeAnswer(spec, 'abc')).toBeNull();
  });

  it('lists every accepted value', () => {
    expect(acceptedCanon(spec)).toEqual(['1.6', '1.7', '1.8', '1.9']);
  });

  it('handles integer steps and large numbers', () => {
    const big: AnswerSpec = { kind: 'number', min: 270, max: 335, step: 1 };
    expect(normalizeAnswer(big, '302 г')).toBe('302');
    expect(normalizeAnswer(big, '316 000')).toBe('316000');
    expect(acceptedCanon(big)).toHaveLength(66);
  });
});

describe('normalizeAnswer: time', () => {
  const spec: AnswerSpec = { kind: 'time', min: '00:35', max: '00:45' };

  it('accepts common time spellings', () => {
    for (const raw of ['0:40', '00.40', '0040', '00 40', '00:40']) expect(normalizeAnswer(spec, raw)).toBe('00:40');
  });

  it('rejects impossible times', () => {
    expect(normalizeAnswer(spec, '25:00')).toBeNull();
    expect(normalizeAnswer(spec, 'опівночі')).toBeNull();
  });

  it('lists every minute in range', () => {
    expect(acceptedCanon(spec)).toHaveLength(11);
    expect(acceptedCanon(spec)[0]).toBe('00:35');
  });
});

describe('normalizeAnswer: choice', () => {
  const spec: AnswerSpec = { kind: 'choice', options: { korzh: ['корж', 'давид корж', 'корж давид'] } };

  it('matches synonyms ignoring case, spaces and apostrophes', () => {
    expect(normalizeAnswer(spec, 'Корж')).toBe('korzh');
    expect(normalizeAnswer(spec, ' давид  КОРЖ ')).toBe('korzh');
    expect(normalizeAnswer({ kind: 'choice', options: { x: ["п'ять"] } }, 'ПʼЯТЬ')).toBe('x');
  });

  it('returns null for unknown names', () => {
    expect(normalizeAnswer(spec, 'Прокопчук')).toBeNull();
  });
});

describe('normalizeCode', () => {
  it('extracts the number from any spelling', () => {
    for (const raw of ['АС-114', 'AC114', 'ас 114', '114', 'https://x.github.io/app/#/code/114']) expect(normalizeCode(raw)).toBe(114);
  });

  it('keeps leading zeros meaningful (start code)', () => {
    expect(normalizeCode('АС-000')).toBe(0);
  });

  it('rejects inputs without a number', () => {
    expect(normalizeCode('АС-')).toBeNull();
    expect(normalizeCode('')).toBeNull();
  });
});

describe('client-side check canonicalization', () => {
  it('canonicalizes by kind without needing the answer table', async () => {
    const { canonForCheck, acceptedForCheck } = await import('./answers.ts');
    expect(canonForCheck({ kind: 'number', step: 0.1 }, '1,75 м/с')).toBe('1.8');
    // код-дата на сейфі: крапки, дефіси й скісні риски між днем, місяцем і роком
    for (const raw of ['16.11.74', '16-11-74', '16/11/74', ' 16 . 11 . 74 ']) expect(canonForCheck({ kind: 'number', step: 1 }, raw), raw).toBe('161174');
    expect(canonForCheck({ kind: 'number', step: 0.01 }, '8.45')).toBe('8.45');
    expect(canonForCheck({ kind: 'time' }, '0.40')).toBe('00:40');
    expect(canonForCheck({ kind: 'text' }, ' Давид  КОРЖ ')).toBe('давид корж');
    expect(acceptedForCheck({ kind: 'choice', options: { korzh: ['Корж', 'Давид Корж'] } })).toEqual(['корж', 'давид корж']);
    expect(acceptedForCheck({ kind: 'number', min: 1.7, max: 1.8, step: 0.1 })).toEqual(['1.7', '1.8']);
  });
});

describe('text answers tolerate punctuation and Latin lookalikes', () => {
  it('strips punctuation and maps Latin lookalike letters to Cyrillic', async () => {
    const { canonForCheck } = await import('./answers.ts');
    expect(canonForCheck({ kind: 'text' }, 'Корж.')).toBe('корж');
    expect(canonForCheck({ kind: 'text' }, '«Корж»!')).toBe('корж');
    expect(canonForCheck({ kind: 'text' }, 'Kорж')).toBe('корж');
    expect(canonForCheck({ kind: 'text' }, 'Д. Корж')).toBe('д корж');
  });
});
