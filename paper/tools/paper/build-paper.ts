// Друкує паперову партію на 40 хв у PDF (Chromium через Playwright) і перевіряє, що нічого не вилізло за аркуш.
// Запуск: npm run paper   → PDF у ../print/ (корінь репозиторію гри).
// CHROMIUM_PATH — шлях до Chromium, якщо Playwright не знайде свій.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { buildPaper } from './content.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = process.env.PAPER_OUT ?? join(root, '../print');
const levels = [
  ['trainee', 'Стажер'],
  ['detective', 'Слідчий'],
] as const;
const PREFIX = 'Справа 17 (40 хв)';

const json = buildPaper();
mkdirSync(join(root, 'app/src/generated'), { recursive: true });
writeFileSync(join(root, 'app/src/generated/paper40.json'), JSON.stringify(json, null, 1));
if (!existsSync(join(root, 'app/src/generated/case.json'))) throw new Error('Спершу npm run content (потрібна геометрія карт з case.json)');

const server = await createServer({ configFile: join(root, 'app/vite.paper.config.ts'), logLevel: 'warn' });
await server.listen();
const base = `http://localhost:${server.config.server.port}/paper.html`;
const exe = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const errors: string[] = [];
const report: string[] = [];
mkdirSync(outDir, { recursive: true });

const jobs: { query: string; file: string; sheets: boolean }[] = [
  ...levels.flatMap(([l, n]) => [
    { query: `view=kit&level=${l}`, file: `${PREFIX} — комплект «${n}».pdf`, sheets: true },
    { query: `view=pack&level=${l}`, file: `${PREFIX} — пачка ведучого «${n}».pdf`, sheets: true },
  ]),
  { query: 'view=guide', file: `${PREFIX} — посібник ведучого.pdf`, sheets: false },
  { query: 'view=forms', file: `${PREFIX} — бланки.pdf`, sheets: true },
  { query: 'view=rules', file: `${PREFIX} — правила гри.pdf`, sheets: false },
];

try {
  for (const job of jobs) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
    page.on('pageerror', (e) => errors.push(`${job.file}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${job.file}: консоль: ${m.text()}`));
    await page.goto(`${base}?${job.query}`, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForSelector('[data-ready="1"]', { timeout: 30_000 });
    await page.evaluate(async () => {
      const settle = Promise.all([
        document.fonts.ready,
        ...[...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); }))),
      ]);
      await Promise.race([settle, new Promise((r) => setTimeout(r, 15_000))]);
    });
    const broken = await page.$$eval('img', (els) => els.filter((i) => !(i as HTMLImageElement).naturalWidth).map((i) => (i as HTMLImageElement).src));
    for (const b of broken) errors.push(`${job.file}: фото не завантажилось: ${b}`);
    const missing = await page.$$eval('.photo-missing', (els) => els.length);
    if (missing) errors.push(`${job.file}: ${missing} фото відсутні`);
    if (job.sheets) {
      const over = await page.$$eval('.sheet', (els) =>
        els.flatMap((s) => {
          const n = (s as HTMLElement).dataset.sheet ?? '?';
          const r = s.getBoundingClientRect();
          const out: string[] = [];
          for (const k of s.querySelectorAll('.doc, .map, .pcard, .paper-form table, .paper-form__q')) {
            const b = k.getBoundingClientRect();
            if (b.bottom > r.bottom - 6 || b.right > r.right + 1) out.push(`аркуш ${n}: ${k.className.split(' ')[0]} виходить за аркуш`);
          }
          for (const slot of s.querySelectorAll('.sheet__slot')) {
            const sr = slot.getBoundingClientRect();
            for (const k of slot.querySelectorAll('figure, svg, .doc')) {
              const b = k.getBoundingClientRect();
              if (b.bottom > sr.bottom + 1 || b.right > sr.right + 1) out.push(`аркуш ${n}: ${k.tagName.toLowerCase()} виходить за свою частину аркуша`);
            }
          }
          // картки й документи обрізають вміст (overflow: hidden) — перевіряємо прокрутку
          for (const k of s.querySelectorAll<HTMLElement>('.pcard, .sheet__slot > .doc, .dossier')) if (k.scrollHeight > k.clientHeight + 2) out.push(`аркуш ${n}: текст обрізано (${k.className.split(' ')[0]})`);
          return [...new Set(out)];
        }),
      );
      errors.push(...over.map((o) => `${job.file}: ${o}`));
    }
    const sheets = await page.$$eval('.sheet', (els) => els.length);
    await page.pdf({ path: join(outDir, job.file), preferCSSPageSize: true, printBackground: true });
    report.push(`${job.file}${job.sheets ? ` — ${sheets} арк.` : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(report.map((r) => `  ✓ ${r}`).join('\n'));
if (errors.length) {
  console.error(`\nПомилки (${errors.length}):\n${errors.map((e) => `  ✗ ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`→ ${outDir}`);
