// Наскрізне проходження акту 1 у справжньому браузері (Microsoft Edge через playwright-core).
// Запуск: npm run e2e   (спершу збирає застосунок)
import { mkdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium, type Page } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(root, 'print/out/screens');
mkdirSync(shots, { recursive: true });
const server = await preview({ root: join(root, 'app'), preview: { port: 4318, strictPort: true }, logLevel: 'warn' });
const base = 'http://localhost:4318/';
const browser = await chromium.launch({ channel: 'msedge' });
const failures: string[] = [];
const T0 = new Date('2026-11-17T18:00:00Z');

function check(cond: unknown, msg: string) {
  if (!cond) failures.push(msg);
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
}

async function fresh(viewport: { width: number; height: number }, isMobile: boolean) {
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: isMobile ? 2 : 1 });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.clock.install({ time: T0 });
  return { ctx, page, errors };
}

const go = (page: Page, hash: string) => page.evaluate((h) => (window.location.hash = h), hash);
const shot = (page: Page, name: string) => page.screenshot({ path: join(shots, `${name}.png`), fullPage: true });
const noHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

async function start(page: Page, level: 'Стажер' | 'Слідчий') {
  await page.goto(`${base}#/code/0`);
  await page.getByLabel('Назва команди').fill('Сови');
  await page.getByLabel(level).check();
  await page.getByRole('button', { name: 'Почати розслідування' }).click();
  await page.waitForURL(/#\/case$/);
}

async function decide(page: Page, option: RegExp) {
  await page.waitForURL(/#\/decision\/R1$/);
  await page.getByRole('button', { name: option }).click();
  await page.getByRole('button', { name: 'Підтвердити' }).click();
}

async function interview(page: Page, code: string) {
  await go(page, '#/enter');
  await page.getByLabel('Код документа').fill(code);
  await page.getByRole('button', { name: 'Відкрити' }).click();
}

try {
  // ---------- Сценарій 1: Стажер, Р1-а, телефон ----------
  {
    const { ctx, page, errors } = await fresh({ width: 375, height: 812 }, true);
    await start(page, 'Стажер');
    await shot(page, 'm-01-case');
    await page.clock.fastForward('08:00');
    await go(page, '#/decision/R1');
    await page.getByText('Що відповісти начальнику відділу?').waitFor();
    await shot(page, 'm-02-decision');
    await decide(page, /Відкрити кримінальне провадження/);

    await interview(page, 'ас 114');
    await page.getByRole('button', { name: 'Допитати' }).click();
    await page.getByRole('button', { name: 'Так' }).click();
    await page.getByText('Протокол допиту свідка').waitFor();
    await interview(page, 'AC117');
    await page.getByRole('button', { name: 'Допитати' }).click();
    await page.getByRole('button', { name: 'Так' }).click();
    await page.getByText('Протокол допиту свідка').waitFor();
    await shot(page, 'm-03-interview');
    await interview(page, 'АС-115');
    await page.waitForURL(/#\/interview\/nelya$/);
    check(await page.getByText('Свідок відмовляється говорити без адвоката').isVisible(), 'третій допит відхилено (квота 2)');

    await go(page, '#/task/Z2');
    await page.getByLabel('Ваша відповідь').fill('Корж');
    await page.getByRole('button', { name: 'Перевірити' }).click();
    await page.getByText('Чисто. Занадто чисто', { exact: false }).waitFor();
    check(true, 'З-2: «Корж» прийнято, реакція слідчої показана');

    await go(page, '#/task/Z1');
    await page.getByRole('button', { name: /Взяти підказку/ }).click();
    await page.getByRole('button', { name: 'Так' }).click();
    check(await page.getByText('Порівняйте, що пише сержант').isVisible(), 'підказка 1 до З-1 показана');
    await page.getByLabel('Ваша відповідь').fill('1,8');
    await page.getByRole('button', { name: 'Перевірити' }).click();
    await page.waitForURL(/#\/envelope\/A$/);
    check(await page.getByRole('heading', { name: 'Відкрийте конверт А' }).isVisible(), 'шлюз А відкриває конверт А');
    await shot(page, 'm-04-envelope');

    await go(page, '#/archive');
    await page.getByText('Цифровий архів').waitFor();
    for (const label of ['Ц-01', 'Ц-02', 'Ц-03', 'Ц-06', '1-09', '1-11']) check(await page.getByText(label, { exact: true }).isVisible(), `архів містить ${label}`);
    await go(page, '#/doc/C02');
    await page.locator('.forensic img').waitFor();
    const photoOk = await page
      .waitForFunction(() => {
        const img = document.querySelector('.forensic img') as HTMLImageElement | null;
        return !!img && img.complete && img.naturalWidth > 0;
      }, null, { timeout: 5000 })
      .then(() => true, () => false);
    check(photoOk, 'фото криміналістів завантажилось');
    await shot(page, 'm-05-forensic');
    check(await noHScroll(page), 'телефон: немає горизонтального прокручування');

    await page.reload();
    await go(page, '#/case');
    check(await page.locator('.banner--ok', { hasText: 'Відкрийте конверт А' }).isVisible(), 'після перезавантаження стан збережено');
    check(errors.length === 0, `телефон: без помилок у консолі (${errors.join(' | ')})`);
    await ctx.close();
  }

  // ---------- Сценарій 2: Слідчий, Р1-б, мультиборд ----------
  {
    const { ctx, page, errors } = await fresh({ width: 1920, height: 1080 }, false);
    await start(page, 'Слідчий');
    await page.clock.fastForward('08:00');
    await go(page, '#/decision/R1');
    await decide(page, /Погодитись — нещасний випадок/);
    await go(page, '#/case');
    check(await page.locator('.banner--warn', { hasText: 'Справу закрито як нещасний випадок.' }).isVisible(), 'Р1-б: банер «справу закрито»');
    await interview(page, '114');
    await page.waitForURL(/#\/interview\/marta$/);
    check(await page.getByText('Справу закрито. Допити неможливі.').isVisible(), 'Р1-б: допити заблоковані');
    await page.clock.fastForward('03:05');
    await go(page, '#/case');
    await page.locator('.banner--warn', { hasText: 'Справу закрито' }).waitFor({ state: 'detached' });
    check(true, 'Р1-б: справу відновлено через 3 хв');
    check((await page.locator('.timer__penalty').textContent()) === '+5', 'штраф +5 у таймері');
    await go(page, '#/archive');
    check(await page.getByText('Ц-02б', { exact: true }).isVisible(), 'архів містить Ц-02б');
    check((await page.getByText('Ц-02', { exact: true }).count()) === 0, 'архів не містить Ц-02');
    await go(page, '#/task/Z1');
    check(await page.getByText('Час падіння ніхто не дасть').isVisible(), 'Слідчий бачить своє формулювання З-1');
    await shot(page, 'd-01-task');
    check(errors.length === 0, `мультиборд: без помилок у консолі (${errors.join(' | ')})`);
    await ctx.close();
  }

  // ---------- Сценарій 3: акт 2 (Стажер) ----------
  {
    const { ctx, page, errors } = await fresh({ width: 390, height: 844 }, true);
    await start(page, 'Стажер');
    await go(page, '#/task/Z1');
    await page.getByLabel('Ваша відповідь').fill('1.8');
    await page.getByRole('button', { name: 'Перевірити' }).click();
    await page.waitForURL(/#\/envelope\/A$/);

    await interview(page, 'АС-212');
    await page.waitForURL(/#\/decision\/R3$/);
    await page.getByRole('button', { name: 'Відпустити під підписку про невиїзд' }).click();
    await page.getByRole('button', { name: 'Підтвердити' }).click();
    check(await page.getByText('29 серпня Орест попросив').isVisible(), 'Р3-б: Корж розповідає про 29 серпня');

    await interview(page, '214');
    await page.waitForURL(/#\/decision\/R7$/);
    await page.getByRole('button', { name: 'Викрити — протокол сфальсифіковано' }).click();
    await page.getByRole('button', { name: 'Підтвердити' }).click();
    await go(page, '#/archive');
    check(await page.getByText('Ц-13', { exact: true }).isVisible(), 'Р7-а: пояснення Дороша в архіві');
    check(await page.getByText('2-06', { exact: true }).isVisible(), 'архів конверта А відкрито');

    await go(page, '#/db');
    await page.getByLabel('Запит до бази').fill('вх 5550 ае');
    await page.getByRole('button', { name: 'Шукати' }).click();
    check(await page.getByText('Volvo XC60', { exact: false }).isVisible(), 'база даних знаходить авто Вейса');

    await go(page, '#/task/Z7');
    await page.getByLabel('Ваша відповідь').fill('1 100 €');
    await page.getByRole('button', { name: 'Перевірити' }).click();
    await page.getByText('Премію сплатив фонд Байди').waitFor();
    check(true, 'З-7 прийнято');

    await go(page, '#/task/Z3');
    await page.getByLabel('Ваша відповідь').fill('8,45');
    await page.getByRole('button', { name: 'Перевірити' }).click();
    await page.waitForURL(/#\/envelope\/B$/);
    check(await page.getByRole('heading', { name: 'Відкрийте конверт Б' }).isVisible(), 'шлюз Б відкриває конверт Б');
    await shot(page, 'm-06-envelope-b');
    check(await noHScroll(page), 'акт 2: немає горизонтального прокручування');
    check(errors.length === 0, `акт 2: без помилок у консолі (${errors.join(' | ')})`);
    await ctx.close();
  }

  // ---------- Сценарій 4: акт 3 (Слідчий), гілка отруєння ----------
  {
    const { ctx, page, errors } = await fresh({ width: 390, height: 844 }, true);
    await start(page, 'Слідчий');
    for (const [task, raw, env] of [['Z1', '1,8', 'A'], ['Z3', '302', 'B']] as const) {
      await go(page, `#/task/${task}`);
      await page.getByLabel('Ваша відповідь').fill(raw);
      await page.getByRole('button', { name: 'Перевірити' }).click();
      await page.waitForURL(new RegExp(`#/envelope/${env}$`));
    }
    check(await page.getByRole('heading', { name: 'Відкрийте конверт Б' }).isVisible(), 'акт 3: конверт Б відкрито');

    await go(page, '#/task/Z5');
    await page.getByLabel('Ваша відповідь').fill('17:10');
    await page.getByRole('button', { name: 'Перевірити' }).click();
    await page.getByText('а не «вранці, о десятій»', { exact: false }).waitFor();
    check(true, 'З-5: тінь спростовує «вранці, о десятій»');

    await go(page, '#/task/Z4');
    await page.getByLabel('Ваша відповідь').fill('0.40');
    await page.getByRole('button', { name: 'Перевірити' }).click();
    await page.waitForURL(/#\/envelope\/C$/);
    check(await page.getByRole('heading', { name: 'Відкрийте конверт В' }).isVisible(), 'шлюз В відкриває конверт В');
    await go(page, '#/archive');
    check(await page.getByText('Ц-07', { exact: true }).isVisible(), 'білінг Ц-07 в архіві');

    await page.clock.fastForward('03:05');
    await go(page, '#/decision/R5');
    await page.getByRole('button', { name: 'Відкласти розмову до завтра' }).click();
    await page.getByRole('button', { name: 'Підтвердити' }).click();
    await page.clock.fastForward('08:05');
    await go(page, '#/case');
    await page.locator('.list').getByRole('link', { name: /З-10/ }).waitFor();
    check(true, 'гілка отруєння: З-10 з’явилась');
    check(await page.locator('.attention').getByRole('link', { name: /Терміново.*З-10/ }).isVisible(), 'гілка отруєння: З-10 позначено як термінову над екраном');
    await go(page, '#/task/Z10');
    await page.getByLabel('Ваша відповідь').fill('0,0157');
    await page.getByRole('button', { name: 'Перевірити' }).click();
    await page.getByText('Луговий житиме', { exact: false }).waitFor();
    await page.clock.fastForward('03:30');
    await go(page, '#/case');
    check((await page.getByText('Степан Луговий помер', { exact: false }).count()) === 0, 'вчасна доза рятує Лугового');
    await shot(page, 'm-07-act3');
    check(errors.length === 0, `акт 3: без помилок у консолі (${errors.join(' | ')})`);
    await ctx.close();
  }

  // ---------- Сценарій 5: акт 4 і фінал (Слідчий) ----------
  {
    const { ctx, page, errors } = await fresh({ width: 390, height: 844 }, true);
    await start(page, 'Слідчий');
    const answer = async (task: string, raw: string) => {
      await go(page, `#/task/${task}`);
      await page.getByLabel('Ваша відповідь').fill(raw);
      await page.getByRole('button', { name: 'Перевірити' }).click();
    };
    await answer('Z1', '1,8');
    await page.waitForURL(/#\/envelope\/A$/);
    // Команда сама вирішує долю Коржа й Дороша — інакше на шлюзі витік за замовчуванням.
    for (const [code, option] of [['212', 'Відпустити під підписку про невиїзд'], ['214', 'Викрити — протокол сфальсифіковано']] as const) {
      await interview(page, code);
      await page.getByRole('button', { name: option }).click();
      await page.getByRole('button', { name: 'Підтвердити' }).click();
    }
    for (const [task, raw, env] of [['Z3', '302', 'B'], ['Z4', '00:40', 'C']] as const) {
      await answer(task, raw);
      await page.waitForURL(new RegExp(`#/envelope/${env}$`));
    }
    await answer('Z5', '17:10');
    await page.getByText('а не «вранці, о десятій»', { exact: false }).waitFor();
    await answer('Z9', '00:45');
    await page.getByText('а не о 23:40', { exact: false }).waitFor();
    await answer('Z6', '316 000 грн');
    await page.getByText('Тепер ви знаєте, хто', { exact: false }).waitFor();
    check(true, 'З-6: касова книга');

    await answer('Z8', '161174');
    await page.waitForURL(/#\/envelope\/D$/);
    check(await page.getByRole('heading', { name: 'Відкрийте конверт Г' }).isVisible(), 'сейф відкриває конверт Г');

    await answer('Z11', 'годинникова вежа');
    await page.getByText('Оперативна група чекає наказу', { exact: false }).waitFor();
    await go(page, '#/decision/R9');
    await page.getByRole('button', { name: 'Дім Прокопчук, Садова, 14' }).click();
    await page.getByRole('button', { name: 'Підтвердити' }).click();
    await go(page, '#/decision/R9b');
    await page.getByRole('button', { name: 'Крамниця «Старожитності», Замкова, 7' }).click();
    await page.getByRole('button', { name: 'Підтвердити' }).click();

    await go(page, '#/accuse');
    await page.getByLabel('Хто вбив Ореста Гайового?').selectOption('prokopchuk');
    await page.getByLabel('Хто зняв оригінал астролябії з вітрини?').selectOption('hayovyi');
    await page.getByLabel('Де оригінал зараз?').selectOption('tower');
    await page.getByLabel('Хто організував схему вивезення астролябії?').selectOption('bayda');
    await page.getByRole('button', { name: 'Висунути звинувачення' }).click();
    await page.waitForURL(/#\/epilogue$/);
    await page.locator('.newspaper__headline').waitFor();
    check(await page.getByRole('heading', { name: 'Убивцю зберігача засуджено' }).isVisible(), 'фінал: вбивцю засуджено');
    check(await page.getByText('Астролябію дістали з ніші', { exact: false }).isVisible(), 'фінал: астролябія в музеї');
    check(await page.getByText('Депутата Романа Байду обвинувачено', { exact: false }).isVisible(), 'фінал: схему викрито (Вейс у крамниці)');
    await shot(page, 'm-08-epilogue');
    check(await noHScroll(page), 'епілог: немає горизонтального прокручування');
    check(errors.length === 0, `фінал: без помилок у консолі (${errors.join(' | ')})`);
    await ctx.close();
  }

  // ---------- Ширина 360 px ----------
  {
    const { ctx, page } = await fresh({ width: 360, height: 740 }, true);
    await start(page, 'Стажер');
    for (const h of ['#/case', '#/enter', '#/archive', '#/doc/1-11', '#/task/Z1', '#/db', '#/team', '#/host']) {
      await go(page, h);
      await page.waitForTimeout(100);
      check(await noHScroll(page), `360 px без горизонтального прокручування: ${h}`);
    }
    await ctx.close();
  }

  // ---------- Етап 5: два телефони однієї команди ----------
  {
    const a = await fresh({ width: 375, height: 812 }, true);
    const b = await fresh({ width: 375, height: 812 }, true);
    const link = async (p: Page) => {
      await go(p, '#/team');
      const qr = p.getByRole('img', { name: 'QR для інших телефонів команди' });
      await qr.waitFor();
      return (await qr.getAttribute('data-qr'))!;
    };
    await start(a.page, 'Стажер');
    await a.page.clock.fastForward('08:00');
    await go(a.page, '#/decision/R1');
    await decide(a.page, /Відкрити кримінальне провадження/);
    const fromA = await link(a.page);
    check(fromA.startsWith(base) && fromA.includes('#/join/'), 'телефони: посилання для іншого телефона');
    await b.page.goto(fromA);
    await b.page.waitForURL(/#\/case$/);
    await go(b.page, '#/decision/R1');
    check(await b.page.getByText('Рішення ухвалено').isVisible(), 'телефони: Б бачить рішення Р1 з телефона А');
    await go(b.page, '#/task/Z1');
    await b.page.getByLabel('Ваша відповідь').fill('1,8');
    await b.page.getByRole('button', { name: 'Перевірити' }).click();
    await b.page.waitForURL(/#\/envelope\/A$/);
    await a.page.goto(await link(b.page));
    await a.page.waitForURL(/#\/case$/);
    check(await a.page.locator('.banner', { hasText: 'Відкрийте конверт А' }).isVisible(), 'телефони: А отримав шлюз А, розв’язаний на телефоні Б');
    check((await a.page.evaluate(() => JSON.parse(localStorage.getItem('astrolabe:v2')!).games.length)) === 1, 'телефони: злиття не створює другу команду');
    await shot(a.page, 's5-01-team');
    check(a.errors.length + b.errors.length === 0, `телефони: без помилок у консолі (${[...a.errors, ...b.errors].join(' | ')})`);
    await a.ctx.close();
    await b.ctx.close();
  }

  // ---------- Етап 5: мультиборд — скорочена партія, друга команда, пульт ведучого ----------
  {
    const { ctx, page, errors } = await fresh({ width: 1920, height: 1080 }, false);
    await page.goto(`${base}#/setup`);
    await page.getByLabel('Назва команди').fill('Сови');
    await page.getByLabel(/60 хвилин/).check();
    await page.getByRole('button', { name: 'Почати розслідування' }).click();
    await page.waitForURL(/#\/case$/);
    await page.locator('.banner', { hasText: 'Відкрийте конверт А' }).waitFor();
    // таймер оновлюється щосекунди
    await page.clock.runFor(1500);
    check((await page.getByLabel('Час розслідування').textContent())?.startsWith('25:'), 'скорочена: годинник з 25:00');
    await go(page, '#/');
    await page.getByRole('button', { name: 'Додати команду' }).click();
    await page.getByLabel('Назва команди').fill('Лиси');
    await page.getByRole('button', { name: 'Почати розслідування' }).click();
    await page.waitForURL(/#\/case$/);
    const teams = await page.getByLabel('Команда').locator('option').allTextContents();
    check(teams.join(',') === 'Сови,Лиси', `мультиборд: дві команди в перемикачі (${teams.join(',')})`);
    const hostCode = process.env.HOST_CODE || (parse(readFileSync(join(root, 'content/cases/astrolabe/case.yaml'), 'utf8')) as { host: { code: string } }).host.code;
    await go(page, '#/host');
    await page.getByLabel('Код ведучого').fill(hostCode);
    await page.getByRole('button', { name: 'Відкрити пульт' }).click();
    await page.getByRole('heading', { name: 'Пульт ведучого' }).waitFor();
    check(await page.getByRole('cell', { name: 'Лиси' }).isVisible(), 'пульт: команда Лиси в таблиці');
    await page.getByRole('button', { name: 'Відкрити шлюз А (+10 хв)' }).click();
    await page.getByRole('button', { name: 'Відкрити шлюз Б (+10 хв)' }).nth(1).waitFor();
    check((await page.getByRole('button', { name: 'Відкрити шлюз Б (+10 хв)' }).count()) === 2, 'пульт: шлюз А відкрито за Лисів');
    await shot(page, 's5-02-host');
    check(errors.length === 0, `мультиборд: без помилок у консолі (${errors.join(' | ')})`);
    await ctx.close();
  }

  // ---------- Етап 5: «Відділи» ----------
  {
    const { ctx, page, errors } = await fresh({ width: 1366, height: 900 }, false);
    await page.goto(`${base}#/setup`);
    await page.getByLabel('Назва команди').fill('Клас');
    await page.getByLabel('Відділи (один комплект)').check();
    await page.getByRole('button', { name: 'Почати розслідування' }).click();
    await page.waitForURL(/#\/case$/);
    await page.clock.fastForward('08:00');
    await go(page, '#/decision/R1');
    await page.getByLabel('Голос: Криміналісти').selectOption('a');
    await page.getByLabel('Голос: Аналітики').selectOption('a');
    await page.getByLabel('Голос: Оперативники').selectOption('c');
    await page.getByText(/Рішення відділів:/).waitFor();
    await page.getByRole('button', { name: 'Підтвердити' }).click();
    await page.getByText('Рішення ухвалено').waitFor();
    check(true, 'відділи: рішення більшістю голосів');
    await go(page, '#/archive');
    await page.getByRole('button', { name: 'Криміналісти' }).click();
    check(!(await page.getByText('1-09', { exact: true }).isVisible()), 'відділи: фільтр архіву ховає чужі документи');
    await shot(page, 's5-03-departments');
    check(errors.length === 0, `відділи: без помилок у консолі (${errors.join(' | ')})`);
    await ctx.close();
  }

  // ---------- Сценарій 9: без мережі ----------
  {
    // Без підміненого годинника: service worker живе у справжньому часі.
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await start(page, 'Стажер');
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 15_000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await ctx.setOffline(true);
    await page.reload();
    await page.getByText('З-1. Упав чи штовхнули?').waitFor({ timeout: 10_000 });
    check(true, 'офлайн: після перезавантаження без мережі гра відкрилася з тим самим станом');
    // фото архіву відкриваються пізніше, тож питаємо файл напряму — як це зробить сторінка
    const photo = await page.evaluate(async () => {
      const r = await fetch('./img/c-02-paving.jpg');
      return r.ok && (await r.blob()).size > 10_000;
    });
    check(photo, 'офлайн: фото з архіву лежать у кеші');
    await ctx.setOffline(false);
    check(errors.length === 0, `офлайн: без помилок на сторінці (${errors.join(' | ')})`);
    await ctx.close();
  }
} catch (e) {
  failures.push(`виняток: ${(e as Error).message.split('\n')[0]}`);
  console.error(e);
} finally {
  await browser.close();
  await new Promise<void>((r) => server.httpServer.close(() => r()));
}

if (failures.length) {
  console.error(`\nНаскрізні перевірки не пройдено:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nНаскрізні перевірки пройдено. Скриншоти: ${shots}`);
