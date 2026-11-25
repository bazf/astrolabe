import { describe, expect, it } from 'vitest';
import { findLeaks, isSiteFile, releaseConfig } from './release-lib.ts';

describe('releaseConfig', () => {
  it('needs both the host code and the public address', () => {
    expect(() => releaseConfig({}, null)).toThrow(/HOST_CODE/);
    expect(() => releaseConfig({ HOST_CODE: 'лис-годинник-71' }, null)).toThrow(/PUBLIC_APP_URL/);
  });

  it('takes them from the environment first, then from release.local.json', () => {
    expect(releaseConfig({ HOST_CODE: ' лис-годинник-71 ', PUBLIC_APP_URL: 'https://me.github.io/case17' }, { hostCode: 'інший-код-ведучого', publicAppUrl: 'https://x/' })).toEqual({
      hostCode: 'лис-годинник-71',
      publicAppUrl: 'https://me.github.io/case17/',
    });
    expect(releaseConfig({}, { hostCode: 'сова-маятник-99', publicAppUrl: 'https://me.github.io/case17/' })).toEqual({ hostCode: 'сова-маятник-99', publicAppUrl: 'https://me.github.io/case17/' });
  });

  it('refuses the default code from case.yaml — it lives in the source', () => {
    expect(() => releaseConfig({ HOST_CODE: 'сова-маятник-3907', PUBLIC_APP_URL: 'https://a/' }, null, 'сова-маятник-3907')).toThrow(/case\.yaml/);
    // той самий ключ після нормалізації: пробіли, тире, регістр
    expect(() => releaseConfig({ HOST_CODE: 'Сова маятник 3907', PUBLIC_APP_URL: 'https://a/' }, null, 'сова-маятник-3907')).toThrow(/case\.yaml/);
  });

  it('refuses a short code that is easy to guess', () => {
    expect(() => releaseConfig({ HOST_CODE: 'abc', PUBLIC_APP_URL: 'https://a/' }, null)).toThrow(/короткий/);
    // розділові знаки не роблять код довшим
    expect(() => releaseConfig({ HOST_CODE: 'a - b - c - d', PUBLIC_APP_URL: 'https://a/' }, null)).toThrow(/короткий/);
  });
});

describe('site files', () => {
  it('leaves the print pages out of the published site — they show every envelope', () => {
    expect(['index.html', 'print.html', 'assets/print-AB.js', 'assets/print-CD.css', 'assets/main-EF.js', 'sw.js'].filter(isSiteFile)).toEqual(['index.html', 'assets/main-EF.js', 'sw.js']);
  });
});

describe('findLeaks', () => {
  it('finds the host code and host texts in any file, case-insensitively', () => {
    const files = [
      { path: 'assets/main.js', text: 'const x = "nothing here"' },
      { path: 'assets/case.js', text: 'blah ЛИС-ГОДИННИК-71 blah' },
      { path: 'index.html', text: 'Скажіть своїми словами, 2–3 хвилини' },
    ];
    expect(findLeaks(files, ['лис-годинник-71', 'Скажіть своїми словами, 2–3 хвилини'])).toEqual([
      'assets/case.js: «лис-годинник-71»',
      'index.html: «Скажіть своїми словами, 2–3 хвилини»',
    ]);
    expect(findLeaks(files.slice(0, 1), ['лис-годинник-71'])).toEqual([]);
  });
});
