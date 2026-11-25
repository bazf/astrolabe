// Друкує комплекти аркушів у PDF через встановлений Microsoft Edge і перевіряє їх.
// Запуск: npm run print  (спершу збирає застосунок)
// PUBLIC_APP_URL — адреса розгорнутого застосунку, на яку ведуть QR.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { parse } from 'yaml';
import { hostCode, PRINT_FILES, printFile, publicAppUrl } from './print-config.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'print/out');
const PUBLIC_APP_URL = publicAppUrl(process.env);
const EXPECTED_SHEETS = Number(process.env.EXPECTED_SHEETS ?? 24);
const levels = ['trainee', 'detective'] as const;
const HOST_CODE = hostCode(process.env, (parse(readFileSync(join(root, 'content/cases/astrolabe/case.yaml'), 'utf8')) as { host: { code: string } }).host.code);

const bundle = JSON.parse(readFileSync(join(root, 'app/src/generated/case.json'), 'utf8')) as { codes: { code: number }[] };
const validCodes = new Set(bundle.codes.map((c) => c.code));

const server = await preview({ root: join(root, 'app'), preview: { port: 4317, strictPort: true }, logLevel: 'warn' });
const base = `http://localhost:4317/`;
const browser = await chromium.launch({ channel: 'msedge' });
const errors: string[] = [];
mkdirSync(outDir, { recursive: true });
// старі PDF з іншими назвами (напр., англійськими з ранніх збірок) не мають потрапити у випуск
for (const f of readdirSync(outDir)) if (f.endsWith('.pdf') && !PRINT_FILES.includes(f)) rmSync(join(outDir, f));

try {
  for (const level of levels) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 2 });
    page.on('pageerror', (e) => errors.push(`${level}: помилка сторінки: ${e.message}`));
    await page.goto(`${base}print.html?level=${level}&base=${encodeURIComponent(PUBLIC_APP_URL)}`, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForSelector('.sheet', { timeout: 15_000 });
    // Шрифти й фото, але не довше 15 с: зламане фото не має вішати збірку.
    await page.evaluate(async () => {
      const settle = Promise.all([
        document.fonts.ready,
        ...[...document.images].map((img) =>
          img.complete ? null : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); }),
        ),
      ]);
      await Promise.race([settle, new Promise((r) => setTimeout(r, 15_000))]);
    });

    // 1. Кількість аркушів і вихід за межі.
    const sheets = await page.$$eval('.sheet', (els) =>
      els.map((s) => {
        const r = s.getBoundingClientRect();
        const over = [...s.querySelectorAll('.doc, .map, .envelope-label')].some((k) => k.getBoundingClientRect().bottom > r.bottom - 6 || k.getBoundingClientRect().right > r.right + 1);
        return { n: (s as HTMLElement).dataset.sheet, over };
      }),
    );
    if (sheets.length !== EXPECTED_SHEETS) errors.push(`${level}: аркушів ${sheets.length}, очікувалось ${EXPECTED_SHEETS}`);
    for (const s of sheets) if (s.over) errors.push(`${level}: аркуш ${s.n} — вміст виходить за поле`);

    // 1б. Нічого не обрізано всередині половинки аркуша і жоден підпис схеми не виходить за її полотно.
    const clipped = await page.$$eval('.sheet', (els) =>
      els.flatMap((s) => {
        const n = (s as HTMLElement).dataset.sheet;
        const out: string[] = [];
        for (const slot of s.querySelectorAll('.sheet__slot')) {
          const r = slot.getBoundingClientRect();
          for (const k of slot.querySelectorAll('figure, svg, .doc')) {
            const b = k.getBoundingClientRect();
            if (b.bottom > r.bottom + 1 || b.right > r.right + 1) out.push(`аркуш ${n}: ${k.tagName.toLowerCase()} виходить за межі своєї частини аркуша`);
          }
        }
        // екранні прямокутники: враховують transform груп (компас тощо), а SVG обрізає саме по своєму вікну
        for (const svg of s.querySelectorAll<SVGSVGElement>('svg:not(.qr)')) {
          const v = svg.getBoundingClientRect();
          for (const t of svg.querySelectorAll<SVGTextElement>('text')) {
            const b = t.getBoundingClientRect();
            if (b.left < v.left - 1 || b.top < v.top - 1 || b.right > v.right + 1 || b.bottom > v.bottom + 1) out.push(`аркуш ${n}: підпис «${t.textContent}» обрізано краєм схеми`);
          }
        }
        return [...new Set(out)];
      }),
    );
    for (const c of clipped) errors.push(`${level}: ${c}`);

    // 2. Заборонений текст.
    const text = await page.evaluate(() => document.body.innerText);
    if (text.includes('1647')) errors.push(`${level}: у тексті є «1647»`);
    if (text.includes('⟨')) errors.push(`${level}: незнайдений ключ тексту`);

    // 3. Кожен QR зчитується й веде на відомий код.
    const qrs = await page.$$('svg.qr');
    for (const el of qrs) {
      const expected = await el.getAttribute('data-qr');
      const png = PNG.sync.read(await el.screenshot());
      const res = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
      const code = Number(expected?.match(/#\/code\/(\d+)$/)?.[1]);
      if (!res) errors.push(`${level}: QR «${expected}» не зчитується`);
      else if (res.data !== expected) errors.push(`${level}: QR зчитано як «${res.data}», очікувалось «${expected}»`);
      if (!expected?.startsWith(PUBLIC_APP_URL) || !validCodes.has(code)) errors.push(`${level}: QR «${expected}» веде не на код справи`);
    }

    // 4. PDF.
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    if (pages !== EXPECTED_SHEETS) errors.push(`${level}: у PDF ${pages} сторінок, очікувалось ${EXPECTED_SHEETS}`);
    const file = join(outDir, printFile(level));
    writeFileSync(file, pdf);
    console.log(`${level}: ${pages} с., ${qrs.length} QR → ${file}`);
    await page.close();
  }

  // Правила гри: без спойлерів і без коду.
  {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 2 });
    page.on('pageerror', (e) => errors.push(`правила: помилка сторінки: ${e.message}`));
    await page.goto(`${base}print.html?guide=rules&base=${encodeURIComponent(PUBLIC_APP_URL)}`, { waitUntil: 'load', timeout: 30_000 });
    const ready = await page.waitForSelector('[data-ready]', { timeout: 15_000 }).then((el) => el.getAttribute('data-ready'));
    if (ready !== '1') errors.push('правила: сторінка не зібралася');
    else {
      await page.evaluate(() => document.fonts.ready);
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes('⟨')) errors.push('правила: незнайдений ключ тексту');
      const qrs = await page.$$('svg.qr');
      const expected = `${PUBLIC_APP_URL}#/code/0`;
      if (qrs.length !== 1) errors.push(`правила: QR ${qrs.length}, очікувався 1`);
      for (const el of qrs) {
        const png = PNG.sync.read(await el.screenshot());
        const res = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
        if (res?.data !== expected) errors.push(`правила: QR зчитано як «${res?.data}», очікувалось «${expected}»`);
      }
      const footer =
        '<div style="width:100%;font:8px sans-serif;color:#777;padding:0 15mm;display:flex;justify-content:space-between">' +
        '<span>Справа № 17 · правила гри</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>';
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: footer,
        margin: { top: '14mm', bottom: '18mm', left: '15mm', right: '15mm' },
      });
      const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      if (pages < 2 || pages > 6) errors.push(`правила: ${pages} с. — очікувалось 2–6`);
      const file = join(outDir, printFile('rules'));
      writeFileSync(file, pdf);
      console.log(`правила гри: ${pages} с. → ${file}`);
    }
    await page.close();
  }

  // Посібник ведучого: розшифровується тим самим кодом, яким збирання запечатало пульт.
  {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 2 });
    page.on('pageerror', (e) => errors.push(`посібник: помилка сторінки: ${e.message}`));
    await page.goto(`${base}print.html?guide=host&code=${encodeURIComponent(HOST_CODE)}&base=${encodeURIComponent(PUBLIC_APP_URL)}`, { waitUntil: 'load', timeout: 30_000 });
    const ready = await page.waitForSelector('[data-ready]', { timeout: 15_000 }).then((el) => el.getAttribute('data-ready'));
    if (ready !== '1') errors.push('посібник: код ведучого не відкриває пульт цієї збірки — збирайте вміст і друк з тим самим HOST_CODE');
    else {
      await page.evaluate(() => document.fonts.ready);
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes('⟨')) errors.push('посібник: незнайдений ключ тексту');
      if (!text.includes(HOST_CODE)) errors.push('посібник: немає коду ведучого');
      const expected = [PUBLIC_APP_URL, `${PUBLIC_APP_URL}#/host`];
      const qrs = await page.$$('svg.qr');
      if (qrs.length !== expected.length) errors.push(`посібник: QR ${qrs.length}, очікувалось ${expected.length}`);
      for (const [i, el] of qrs.entries()) {
        const png = PNG.sync.read(await el.screenshot());
        const res = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
        if (res?.data !== expected[i]) errors.push(`посібник: QR ${i + 1} зчитано як «${res?.data}», очікувалось «${expected[i]}»`);
      }
      const footer =
        '<div style="width:100%;font:8px sans-serif;color:#777;padding:0 15mm;display:flex;justify-content:space-between">' +
        '<span>Справа № 17 · посібник ведучого · не показувати гравцям</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>';
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: footer,
        margin: { top: '14mm', bottom: '18mm', left: '15mm', right: '15mm' },
      });
      const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      if (pages < 8 || pages > 30) errors.push(`посібник: ${pages} с. — очікувалось 8–30`);
      const file = join(outDir, printFile('guide'));
      writeFileSync(file, pdf);
      console.log(`посібник ведучого: ${pages} с. → ${file}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise<void>((r) => server.httpServer.close(() => r()));
}

if (errors.length) {
  console.error(`Перевірки друку не пройдено:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('Перевірки друку пройдено.');
