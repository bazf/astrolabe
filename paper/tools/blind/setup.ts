// Готує сліпі проходження: копію зібраного застосунку, сховище аркушів (PNG + текст) і теки агентів.
// Запуск (спершу npm run build):
//   node --experimental-strip-types --no-warnings tools/blind/setup.ts <тека> <назва>:<trainee|detective> ...
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import type { CaseBundle, Level } from '../../shared/case-types.ts';
import { sheetSections } from './lib.ts';
import { serveDir } from './serve.ts';

const repo = join(dirname(fileURLToPath(import.meta.url)), '../..');
const [outArg, ...runArgs] = process.argv.slice(2);
if (!outArg || !runArgs.length) throw new Error('Використання: setup.ts <тека> <назва>:<trainee|detective> ...');
const out = resolve(outArg);
if (existsSync(out)) throw new Error(`${out} уже існує — сліпі проходження готуються в нову теку`);

const runs = runArgs.map((r) => {
  const [name, level] = r.split(':');
  if (!name || (level !== 'trainee' && level !== 'detective')) throw new Error(`Неправильний запуск «${r}»`);
  return { name, level: level as Level };
});

/** 1,4 пікселя на CSS-піксель: аркуш А4 ≈ 1111 × 1572 px — читається цілком. */
const DPR = 1.4;
const HI_DPR = 3;
const PX_PER_MM = (96 / 25.4) * DPR;

const site = join(out, 'site');
cpSync(join(repo, 'app/dist'), site, { recursive: true });
const bundle = JSON.parse(readFileSync(join(repo, 'app/src/generated/case.json'), 'utf8')) as CaseBundle;
const sheets = sheetSections(bundle.docs);

const port = 4389;
const server = await serveDir(site, port);
const browser = await chromium.launch({ channel: 'msedge' });
try {
  for (const level of new Set(runs.map((r) => r.level))) {
    const vault = join(out, 'vault', level);
    mkdirSync(vault, { recursive: true });
    for (const [dpr, suffix] of [[DPR, ''], [HI_DPR, '@hi']] as const) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: dpr });
      await page.goto(`http://127.0.0.1:${port}/print.html?level=${level}&base=${encodeURIComponent('https://astrolabe.example/')}`);
      await page.waitForSelector('.sheet');
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
      });
      for (const el of await page.$$('.sheet')) {
        const n = Number(await el.getAttribute('data-sheet'));
        const name = `аркуш-${String(n).padStart(2, '0')}`;
        await el.screenshot({ path: join(vault, `${name}${suffix}.png`) });
        if (!suffix) writeFileSync(join(vault, `${name}.txt`), await el.innerText());
      }
      await page.close();
    }
    console.log(`аркуші (${level}) → ${vault}`);
  }
} finally {
  await browser.close();
  await server.close();
}

const HOW = readFileSync(join(repo, 'tools/blind/ЯК-ГРАТИ.md'), 'utf8');
runs.forEach((r, i) => {
  const dir = join(out, `run-${r.name}`);
  for (const d of ['materials', 'shots', '.play']) mkdirSync(join(dir, d), { recursive: true });
  const t0 = Date.UTC(2026, 10, 20, 7, 0);
  const config = { site, vault: join(out, 'vault', r.level), level: r.level, port: 4390 + i, t0, pxPerMm: PX_PER_MM, hiScale: HI_DPR / DPR, sheets: [...sheets.entries()] };
  writeFileSync(join(dir, '.play/config.json'), JSON.stringify(config, null, 2));
  writeFileSync(join(dir, '.play/state.json'), JSON.stringify({ t: t0, hash: '#/', revealed: [], shots: 0 }));
  writeFileSync(join(dir, 'play'), `#!/bin/sh\nexec node --experimental-strip-types --no-warnings "${join(repo, 'tools/blind/play.ts')}" --run "${dir}" "$@"\n`);
  chmodSync(join(dir, 'play'), 0o755);
  writeFileSync(join(dir, 'ЯК-ГРАТИ.md'), HOW);
  console.log(`тека агента: ${dir}`);
});
