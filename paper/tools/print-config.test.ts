import { describe, expect, it } from 'vitest';
import { hostCode, PRINT_FILES, printFile, publicAppUrl } from './print-config.ts';
import { ui } from '../app/src/ui/strings.ts';

describe('publicAppUrl', () => {
  it('refuses to print with no deployed address', () => {
    expect(() => publicAppUrl({})).toThrow(/PUBLIC_APP_URL/);
  });
  it('allows an explicit placeholder for test prints', () => {
    expect(publicAppUrl({ ALLOW_PLACEHOLDER_URL: '1' })).toBe('https://example.github.io/astrolabe/');
  });
  it('normalizes the trailing slash', () => {
    expect(publicAppUrl({ PUBLIC_APP_URL: 'https://me.github.io/case17' })).toBe('https://me.github.io/case17/');
  });
});

describe('hostCode', () => {
  it('takes HOST_CODE first — the same code the build sealed the console with', () => {
    expect(hostCode({ HOST_CODE: ' лис-7 ' }, 'сова-1')).toBe('лис-7');
  });
  it('falls back to the code in case.yaml', () => {
    expect(hostCode({}, 'сова-1')).toBe('сова-1');
  });
});

describe('printFile', () => {
  it('names the PDFs in Ukrainian, the way the game names them', () => {
    expect(printFile('trainee')).toBe('Справа № 17 — комплект «Стажер».pdf');
    expect(printFile('detective')).toBe('Справа № 17 — комплект «Слідчий».pdf');
    expect(printFile('guide')).toBe('Справа № 17 — посібник ведучого.pdf');
    expect(printFile('rules')).toBe('Справа № 17 — правила гри.pdf');
  });
  it('uses the level names from the app itself', () => {
    expect(printFile('trainee')).toContain(`«${ui.levelTrainee}»`);
    expect(printFile('detective')).toContain(`«${ui.levelDetective}»`);
  });
  it('lists exactly the files a release ships', () => {
    expect(PRINT_FILES).toEqual([printFile('rules'), printFile('trainee'), printFile('detective'), printFile('guide')]);
  });
});
