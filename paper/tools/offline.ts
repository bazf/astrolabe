// Офлайн-режим застосунку: під час збирання пишемо sw.js зі списком файлів збірки.
// Service worker кешує гру при першому відкритті; далі вона відкривається й перезавантажується без мережі.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

/** Що кешувати: усе, крім сторінок друку, старого формату шрифтів (є woff2), мап коду й самого sw.js. */
export function precacheList(files: string[]): string[] {
  const skip = (f: string) =>
    f === 'sw.js' ||
    f === 'print.html' ||
    /^assets\/print-/.test(f) ||
    f.endsWith('.woff') ||
    f.endsWith('.map') ||
    f.split('/').some((p) => p.startsWith('.'));
  return ['./', ...files.filter((f) => !skip(f)).sort()];
}

/** Версія збірки — відбиток вмісту всіх файлів: зміна будь-якого файлу дає новий кеш. */
export function buildVersion(entries: { path: string; bytes: Uint8Array }[]): string {
  const h = createHash('sha256');
  for (const e of [...entries].sort((a, b) => a.path.localeCompare(b.path))) h.update(e.path).update('\0').update(e.bytes).update('\0');
  return h.digest('hex').slice(0, 12);
}

export function swSource(files: string[], version: string): string {
  return `// Згенеровано під час збирання (tools/offline.ts).
const CACHE = ${JSON.stringify(`astrolabe-${version}`)};
const FILES = ${JSON.stringify(files)};

self.addEventListener('install', (e) => {
  // повз HTTP-кеш браузера: одразу після публікації він ще може віддати старі файли
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('astrolabe-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const late = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Свіжа сторінка, якщо мережа відповідає швидко; інакше — сторінка цієї збірки з кешу.
    // У кеш нічого не дописуємо: відкрите в новій вкладці фото чи сторінка нової збірки не мають підмінити гру.
    // сторінки друку в кеші немає: для неї без мережі — звичайна помилка
    const target = url.pathname.endsWith('print.html') ? req : './';
    e.respondWith(
      Promise.race([fetch(req), late(4000)]).catch(() => caches.match(target, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || Response.error())),
    );
    return;
  }
  // Vite підключає модулі з crossorigin; відповідь із «Vary: Origin» без ignoreVary не знайшлася б.
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || fetch(req)));
});
`;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Плагін Vite: після збирання пише sw.js у теку збірки. */
export function offlinePlugin(): Plugin {
  let outDir = '';
  return {
    name: 'astrolabe-offline',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const all = walk(outDir).map((p) => relative(outDir, p).split(sep).join('/'));
      const files = precacheList(all);
      const version = buildVersion(files.filter((f) => f !== './').map((f) => ({ path: f, bytes: readFileSync(join(outDir, f)) })));
      writeFileSync(join(outDir, 'sw.js'), swSource(files, version));
    },
  };
}
