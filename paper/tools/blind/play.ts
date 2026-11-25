// Сліпе проходження: один крок гравця у справжньому застосунку (безголовий Edge, підмінений годинник).
// Агент викликає ./play <команда> зі своєї теки; див. ЯК-ГРАТИ.md.
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { chromium, type Locator, type Page } from 'playwright-core';
import { PNG } from 'pngjs';
import type { Level, Section } from '../../shared/case-types.ts';
import { distanceMm, envelopeDir, openSections, toRevealSheets } from './lib.ts';
import { serveDir } from './serve.ts';

type Config = { site: string; vault: string; level: Level; port: number; t0: number; pxPerMm: number; hiScale: number; sheets: [number, Section][] };
type State = { t: number; hash: string; revealed: number[]; shots: number };

class Fail extends Error {}
const fail = (msg: string): never => {
  throw new Fail(msg);
};

const argv = process.argv.slice(2);
if (argv[0] !== '--run' || !argv[1]) throw new Error('play: не вказано теку проходження');
const dir = resolve(argv[1]);
type Step = { cmd: string; args: string[] };
/** Кілька кроків в одній команді: ./play fill "Поле" "1,8" + click "Перевірити" (поля форм не переживають перезавантаження). */
const steps: Step[] = [];
for (const a of argv.slice(2)) {
  if (a === '+' || !steps.length) steps.push({ cmd: a === '+' ? '' : a, args: [] });
  else if (!steps[steps.length - 1].cmd) steps[steps.length - 1].cmd = a;
  else steps[steps.length - 1].args.push(a);
}
const { cmd = 'help', args = [] } = steps[0] ?? {};
const cfg = JSON.parse(readFileSync(join(dir, '.play/config.json'), 'utf8')) as Config;
const statePath = join(dir, '.play/state.json');
const state = JSON.parse(readFileSync(statePath, 'utf8')) as State;
const minutes = () => Math.round((state.t - cfg.t0) / 60_000);
const save = () => writeFileSync(statePath, JSON.stringify(state));
const journal = (e: Record<string, unknown>) => appendFileSync(join(dir, '.play/journal.jsonl'), JSON.stringify({ min: minutes(), at: new Date().toISOString(), ...e }) + '\n');
const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** Числовий останній аргумент — номер однакової кнопки: click "Допитати" 2. */
const nth = (args: string[]): number | null => {
  const n = Number(args[args.length - 1]);
  return args.length > 1 && Number.isInteger(n) && n >= 1 ? n : null;
};

// ---------- команди без браузера ----------

function sheetPng(file: string): { n: number; pxPerMm: number; hi?: string } {
  const p = resolve(dir, file);
  if (!existsSync(p)) fail(`немає файлу ${file}`);
  if (existsSync(`${p}.json`)) return JSON.parse(readFileSync(`${p}.json`, 'utf8'));
  const n = Number(basename(p).match(/аркуш-(\d+)\.png$/)?.[1]);
  if (!n || !state.revealed.includes(n)) fail(`${file} — не аркуш із ваших матеріалів`);
  return { n, pxPerMm: cfg.pxPerMm, hi: join(cfg.vault, `аркуш-${pad(n)}@hi.png`) };
}

function offline(): boolean {
  switch (cmd) {
    case 'help':
      console.log(readFileSync(join(dir, 'ЯК-ГРАТИ.md'), 'utf8'));
      return true;
    case 'note': {
      const text = args.join(' ').trim();
      if (!text) fail('порожня нотатка');
      journal({ cmd, text });
      console.log(`✓ нотатку записано (хв ${minutes()})`);
      return true;
    }
    case 'ruler': {
      const [file, ...nums] = args;
      const v = nums.map(Number);
      if (!file || v.length !== 4 || v.some((x) => !Number.isFinite(x))) fail('ruler <файл.png> x1 y1 x2 y2');
      const s = sheetPng(file);
      const mm = distanceMm([v[0], v[1]], [v[2], v[3]], s.pxPerMm);
      journal({ cmd, args });
      console.log(`📏 ${mm.toFixed(1)} мм на папері (від (${v[0]}, ${v[1]}) до (${v[2]}, ${v[3]}) у пікселях ${file})`);
      return true;
    }
    case 'crop': {
      const [file, ...nums] = args;
      const [x, y, w, h] = nums.map(Number);
      if (!file || ![x, y, w, h].every((n) => Number.isFinite(n) && n >= 0) || !w || !h) fail('crop <аркуш-NN.png> x y ширина висота  (у пікселях аркуша)');
      const s = sheetPng(file);
      if (!s.hi) fail('збільшувати можна лише цілий аркуш із materials/');
      const src = PNG.sync.read(readFileSync(s.hi!));
      const k = cfg.hiScale;
      const [sx, sy] = [Math.round(x * k), Math.round(y * k)];
      const [cw, ch] = [Math.min(Math.round(w * k), src.width - sx), Math.min(Math.round(h * k), src.height - sy)];
      if (cw <= 0 || ch <= 0) fail('фрагмент поза аркушем');
      const dst = new PNG({ width: cw, height: ch });
      PNG.bitblt(src, dst, sx, sy, cw, ch, 0, 0);
      state.shots += 1;
      const out = join('shots', `збільшення-${pad(state.shots, 3)}-аркуш-${pad(s.n)}.png`);
      writeFileSync(join(dir, out), PNG.sync.write(dst));
      writeFileSync(join(dir, `${out}.json`), JSON.stringify({ n: s.n, pxPerMm: cfg.pxPerMm * k }));
      save();
      journal({ cmd, args });
      console.log(`🔍 ${out}: ${cw}×${ch} px, ${(cfg.pxPerMm * k).toFixed(2)} px/мм (ruler працює і на ньому)`);
      return true;
    }
  }
  return false;
}

// ---------- команди в застосунку ----------

const BROWSER = ['look', 'go', 'click', 'fill', 'check', 'select', 'wait', 'shot', 'back'];

async function inApp(): Promise<void> {
  for (const [i, st] of steps.entries()) {
    if (!BROWSER.includes(st.cmd)) fail(`невідома команда «${st.cmd}». ./play help — список команд`);
    if (i > 0 && st.cmd === 'wait') fail('wait — лише першим кроком');
  }
  if (cmd === 'wait') {
    const n = Number(args[0]);
    if (!Number.isFinite(n) || n <= 0 || n > 30) fail('wait <хвилини 1–30> [що робила команда]');
  }
  const lock = join(dir, '.play/lock');
  if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs < 90_000) fail('попередня команда ще виконується — запускайте команди по одній');
  writeFileSync(lock, String(process.pid));

  let server: Awaited<ReturnType<typeof serveDir>> | undefined;
  let ctx: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;
  try {
    server = await serveDir(cfg.site, cfg.port).catch(() => fail(`порт ${cfg.port} зайнятий — чи не працює ще одна команда?`));
    ctx = await chromium.launchPersistentContext(join(dir, '.play/profile'), { channel: 'msedge', headless: true, viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 });
    if (cmd === 'wait') {
      state.t += Math.round(Number(args[0]) * 60_000);
      journal({ cmd, added: Number(args[0]), text: args.slice(1).join(' ') });
    }
    await ctx.clock.install({ time: state.t });
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => void d.accept());
    await page.goto(`http://127.0.0.1:${cfg.port}/${state.hash}`);
    await page.waitForSelector('#root *');
    await page.waitForTimeout(500);
    // Крок, що не вдався, зупиняє ланцюжок, але екран після попередніх кроків показуємо.
    for (const [i, st] of steps.entries()) {
      try {
        await act(page, st);
        await page.waitForTimeout(st.cmd === 'look' || st.cmd === 'wait' ? 0 : 800);
        if (st.cmd === 'shot') await shoot(page, st.args);
      } catch (e) {
        console.log(`✗ крок ${i + 1} (${st.cmd}): ${e instanceof Fail ? e.message : (e as Error).message.split('\n')[0]}`);
        process.exitCode = 1;
        break;
      }
    }
    state.hash = await page.evaluate(() => window.location.hash || '#/');
    const screen = await readScreen(page);
    const board = await page.evaluate(() => localStorage.getItem('astrolabe:v2'));
    const fresh = reveal(board);

    console.log(`━━ хв від початку: ${minutes()} · екран ${state.hash}`);
    console.log(screen.text.trim());
    console.log('━━ на екрані:');
    for (const c of screen.controls) console.log(`  ${c}`);
    if (screen.images.length) console.log(`━━ зображення: ${screen.images.map((i) => `«${i}»`).join(', ')} — ./play shot, щоб подивитися`);
    const level = activeLevel(board);
    if (level && level !== cfg.level) console.log(`⚠ Гра йде на рівні ${level}, а аркуші надруковано для ${cfg.level}. Почніть заново з потрібним рівнем.`);
    if (fresh.length) console.log(`━━ 📂 НОВІ ПАПЕРОВІ МАТЕРІАЛИ (конверт відкрито):\n  ${fresh.join('\n  ')}`);
    if (errors.length) console.log(`━━ ⚠ помилки сторінки: ${errors.join(' | ')}`);
    journal({ steps, hash: state.hash, revealed: fresh, screen: screen.text, errors });
  } finally {
    save();
    await ctx?.close();
    await server?.close();
    rmSync(lock, { force: true });
  }
}

async function pick(loc: Locator, what: string, args: string[]): Promise<Locator> {
  const count = await loc.count();
  const n = nth(args);
  if (count > 1 && n === null) console.log(`ℹ «${what}» трапляється ${count} рази — натиснуто перший; інший: click "${what}" 2`);
  if ((n ?? 1) > count) fail(`«${what}»: є лише ${count}`);
  return loc.nth((n ?? 1) - 1);
}

async function byName(page: Page, name: string, args: string[]): Promise<Locator> {
  for (const exact of [true, false])
    for (const role of ['button', 'link', 'tab', 'radio', 'checkbox'] as const) {
      const loc = page.getByRole(role, { name, exact });
      if (await loc.count()) return pick(loc, name, args);
    }
  const text = page.getByText(name, { exact: true });
  if (await text.count()) return pick(text, name, args);
  return fail(`немає кнопки чи посилання «${name}» на цьому екрані`);
}

async function byLabel(page: Page, label: string): Promise<Locator> {
  for (const exact of [true, false]) {
    const loc = page.getByLabel(label, { exact });
    if (await loc.count()) return loc.first();
  }
  return fail(`немає поля «${label}» на цьому екрані`);
}

async function act(page: Page, { cmd, args }: Step): Promise<void> {
  switch (cmd) {
    case 'go': {
      const h = args[0] ?? '#/';
      await page.evaluate((x) => (window.location.hash = x), h.startsWith('#') ? h : `#${h}`);
      return;
    }
    case 'back':
      await page.goBack();
      return;
    case 'click':
      await (await byName(page, args[0] ?? fail('click "<текст кнопки>" [номер]'), args)).click();
      return;
    case 'fill':
      if (args.length < 2) fail('fill "<підпис поля>" "<значення>"');
      await (await byLabel(page, args[0])).fill(args.slice(1).join(' '));
      return;
    case 'check':
      await (await byLabel(page, args[0] ?? fail('check "<підпис>"'))).check();
      return;
    case 'select':
      if (args.length < 2) fail('select "<підпис списку>" "<варіант>"');
      await (await byLabel(page, args[0])).selectOption({ label: args[1] });
      return;
  }
}

async function shoot(page: Page, args: string[]): Promise<void> {
  const files: string[] = [];
  if (args[0] !== 'page') {
    for (const el of await page.$$('#root img, #root svg, #root canvas')) {
      const box = await el.boundingBox();
      if (!box || box.width < 120 || box.height < 80) continue;
      state.shots += 1;
      const f = join('shots', `екран-${pad(state.shots, 3)}.png`);
      await el.screenshot({ path: join(dir, f) });
      files.push(f);
    }
  }
  if (!files.length) {
    state.shots += 1;
    const f = join('shots', `екран-${pad(state.shots, 3)}-цілий.png`);
    await page.screenshot({ path: join(dir, f), fullPage: true });
    files.push(f);
  }
  console.log(`📷 ${files.join(', ')}`);
}

function readScreen(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('root')!;
    const visible = (el: Element) => (el as HTMLElement).getClientRects().length > 0;
    const name = (el: HTMLElement) => {
      const input = el as HTMLInputElement;
      return el.getAttribute('aria-label') || (input.labels?.[0]?.innerText ?? '').trim() || el.innerText?.trim().replace(/\s+/g, ' ') || el.getAttribute('title') || input.placeholder || '';
    };
    const controls: string[] = [];
    for (const el of root.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary')) {
      if (!visible(el)) continue;
      const off = (el as HTMLButtonElement).disabled ? ' (неактивна)' : '';
      const tag = el.tagName.toLowerCase();
      if (tag === 'button' || tag === 'summary') controls.push(`[кнопка] ${name(el)}${off}`);
      else if (tag === 'a') controls.push(`[посилання] ${name(el)} → ${el.getAttribute('href')}`);
      else if (tag === 'select') controls.push(`[список] ${name(el)}: ${[...(el as HTMLSelectElement).options].map((o) => (o.selected ? `«${o.text}» (обрано)` : `«${o.text}»`)).join(', ')}`);
      else {
        const i = el as HTMLInputElement;
        if (i.type === 'radio' || i.type === 'checkbox') controls.push(`[${i.type === 'radio' ? 'перемикач' : 'прапорець'}] ${name(el)}${i.checked ? ' (обрано)' : ''}`);
        else controls.push(`[поле] ${name(el)} = «${i.value}»`);
      }
    }
    const images = [...root.querySelectorAll('img')].filter(visible).map((i) => i.alt || i.getAttribute('src') || '');
    return { text: root.innerText.replace(/\n{3,}/g, '\n\n'), controls, images };
  });
}

function activeLevel(board: string | null): Level | undefined {
  try {
    const b = JSON.parse(board ?? 'null') as { games?: { id: string; level: Level }[]; active?: string } | null;
    return b?.games?.find((g) => g.id === b.active)?.level;
  } catch {
    return undefined;
  }
}

/** Конверти, які застосунок дозволив відкрити, — у теку materials/. */
function reveal(board: string | null): string[] {
  const sheets = new Map(cfg.sheets);
  const out: string[] = [];
  for (const n of toRevealSheets(sheets, openSections(board), state.revealed)) {
    const name = `аркуш-${pad(n)}`;
    const env = envelopeDir(sheets.get(n)!);
    mkdirSync(join(dir, 'materials', env), { recursive: true });
    for (const ext of ['png', 'txt']) copyFileSync(join(cfg.vault, `${name}.${ext}`), join(dir, 'materials', env, `${name}.${ext}`));
    state.revealed.push(n);
    out.push(`materials/${env}/${name}.png (+ .txt)`);
  }
  return out;
}

try {
  if (!offline()) await inApp();
} catch (e) {
  console.log(`✗ ${e instanceof Fail ? e.message : (e as Error).message.split('\n')[0]}`);
  if (!(e instanceof Fail)) journal({ steps, error: (e as Error).message.split('\n')[0] });
  process.exitCode = 1;
}
