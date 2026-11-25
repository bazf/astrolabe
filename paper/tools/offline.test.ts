import { describe, expect, it } from 'vitest';
import { buildVersion, precacheList, swSource } from './offline.ts';

describe('offline: what the service worker caches', () => {
  const files = [
    'index.html',
    'print.html',
    'sw.js',
    'favicon.svg',
    'manifest.webmanifest',
    'icons/icon-192.png',
    'assets/main-AB12.js',
    'assets/main-CD34.css',
    'assets/case-EF56.js',
    'assets/print-GH78.js',
    'assets/print-IJ90.css',
    'assets/pt-serif-cyrillic-400-normal-X.woff2',
    'assets/pt-serif-cyrillic-400-normal-X.woff',
    'assets/main-AB12.js.map',
    'img/photo-1-02.jpg',
    '.DS_Store',
  ];

  it('takes the game and its photos, but not the print pages, old font formats, maps or itself', () => {
    expect(precacheList(files)).toEqual([
      './',
      'assets/case-EF56.js',
      'assets/main-AB12.js',
      'assets/main-CD34.css',
      'assets/pt-serif-cyrillic-400-normal-X.woff2',
      'favicon.svg',
      'icons/icon-192.png',
      'img/photo-1-02.jpg',
      'index.html',
      'manifest.webmanifest',
    ]);
  });

  it('changes the version when any file changes, even with the same names', () => {
    const a = buildVersion([{ path: 'index.html', bytes: Buffer.from('a') }]);
    expect(buildVersion([{ path: 'index.html', bytes: Buffer.from('a') }])).toBe(a);
    expect(buildVersion([{ path: 'index.html', bytes: Buffer.from('b') }])).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });

  it('writes a worker that caches the list under a versioned name and drops older caches', () => {
    const src = swSource(['./', 'index.html'], 'abc123');
    expect(src).toContain('"astrolabe-abc123"');
    expect(src).toContain('["./","index.html"]');
    expect(src).toMatch(/caches\.delete/);
    // модульні скрипти Vite йдуть із crossorigin: без ignoreVary відповідь із «Vary: Origin» не знаходиться в кеші
    expect(src.match(/caches\.match\([^)]*\)/g)!.every((m) => m.includes('ignoreVary: true'))).toBe(true);
    expect(() => new Function(src)).not.toThrow();
  });

  it('never writes a navigated page into the cache and fetches the precache past the HTTP cache', () => {
    const src = swSource(['./', 'index.html'], 'abc123');
    // інакше відкрите в новій вкладці фото або сторінка нової збірки підмінили б './'
    expect(src).not.toMatch(/\.put\(/);
    expect(src).toContain("cache: 'reload'");
  });
});
