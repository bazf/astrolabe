# Вертикальний зріз: стартовий конверт і акт 1 — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Зіграти перші ~25 хвилин справи «Астролябія» наживо: надруковані аркуші 01–12 обох рівнів і застосунок, що веде від старту через Р1, Р2, З-1/З-2 до шлюзу А і команди «Відкрийте конверт А».

**Architecture:**
- Вміст справи пишеться в YAML (`content/`), а скрипт збирання перетворює його на `app/src/generated/case.json`. Відповіді в цьому JSON хешовані, а вміст за шлюзами зашифрований ключем, який виводиться з правильної відповіді.
- Застосунок — статичний React (hash-маршрути, стан у localStorage) з чистим рушієм-редʼюсером.
- Друковані аркуші — ті самі React-компоненти документів на окремій сторінці `print.html`; Playwright (через встановлений Microsoft Edge) зберігає їх у PDF А4.

**Tech Stack:** React 19, Vite 7, TypeScript 5.8, Vitest 3, `yaml` 2, `qrcode` 1.5, `qr-scanner` 1.4, `playwright-core` (channel `msedge`), Node 23 з `--experimental-strip-types` для скриптів на TS.

**Spec:** `docs/case-bible.md` (затверджено), загальний план — `~/.claude/plans/pasted-content-id-7c14-woolly-thimble.md`.

## Global Constraints

- Увесь інтерфейс і тексти — українською; тексти справи лише в `content/cases/astrolabe/uk/`, не в коді компонентів (готовність до перекладу).
- Без бекенду: GitHub Pages, `base: './'`, hash-маршрути; будь-який доступ до localStorage — у try/catch, гра працює і без нього (стан лише в пам'яті).
- QR необов'язковий: кожен QR дублюється текстовим кодом «АС-###»; код приймається з кирилицею, латиницею, пробілами, без дефіса.
- Друк: ≤ 25 аркушів А4 на комплект; зріз друкує аркуші 01–12 (розділ 6.1 біблії), по одному PDF на рівень.
- Числа завдань беруться з `tools/solve.mjs`, не вписуються вручну.
- Відповіді шлюзів ніде не лежать відкритим текстом у зібраному застосунку; підказки й тексти — щонайменше обфусковані.
- 16+: жодних повних зображень тіла чи ушкоджень (лише покривало, черевик на краю кадру).
- Мобільна ширина 360 px без горизонтального прокручування; поля 16 px.

## Review Focus

1. **Перезавантаження або закрита вкладка посеред гри**: таймер, штрафи, прийняті рішення, використані допити й відкриті розділи мають відновитися після перезавантаження сторінки (Task 3, тест `restores after reload`).
2. **QR, відсканований системною камерою, відкриває застосунок «з нуля»** (`#/code/114` без розпочатої гри): треба запропонувати почати гру й потім виконати код, а не показати помилку (Task 5, тест `code before start`).
3. **Відповідь у «людському» форматі**: «1,8», «1.8 м/с», « 1.75», «00.40», «0:40», «Корж» / «корж» / «Давид Корж» мають прийматися, а «18» — ні (Task 1, тести нормалізації).
4. **Код допиту до події Е1** або після вичерпаної квоти: допит до Р1 запускає Е1 негайно; понад квоту — відмова свідка, квота не змінюється (Task 3).
5. **localStorage недоступний** (приватний режим, Safari): гра стартує, лише попереджає, що прогрес не збережеться (Task 3, тест `storage throws`).

---

## Структура файлів

```
shared/                         — код, спільний для застосунку й скриптів (TS, без залежностей від DOM)
  answers.ts                    — нормалізація відповідей і кодів
  seal.ts                       — хешування, шифрування, обфускація (WebCrypto)
  case-types.ts                 — типи вмісту справи
content/cases/astrolabe/
  case.yaml                     — маніфест: завдання, шлюзи, рішення, події, коди, документи, аркуші
  geometry.yaml                 — координати карти міста й плану Ринку
  uk/act1.yaml                  — тексти акту 1: брифінг, допити, дзвінок, підказки, вирізки
tools/
  solve.mjs                     — (є) числа завдань
  build-content.ts              — YAML → app/src/generated/case.json (+ перевірки)
  build-print.ts                — Playwright → print/out/kit-{trainee,detective}.pdf
app/
  index.html, print.html        — дві сторінки Vite
  src/engine/                   — рушій: state.ts, reducer.ts, events.ts, storage.ts
  src/ui/                       — екрани застосунку
  src/documents/                — компоненти документів (спільні для екрана й друку)
  src/maps/                     — SVG карт і креслень з geometry
  src/print/                    — розкладка аркушів 01–12
  public/img/                   — фото (генеровані)
assets/prompts/                 — промпти до кожного фото
```

---

### Task 1: Спільне ядро — нормалізація відповідей і запечатування

**Files:**
- Create: `shared/answers.ts`, `shared/seal.ts`, `shared/answers.test.ts`, `shared/seal.test.ts`, `vitest.config.ts`
- Modify: `package.json` (devDeps: `vitest@^3`, скрипт `test`), `app/tsconfig.json` (`allowImportingTsExtensions: true`, include `../shared`)

**Interfaces:**
- Produces:
  - `type AnswerSpec = { kind: 'number'; min: number; max: number; step: number } | { kind: 'time'; min: string; max: string } | { kind: 'choice'; options: Record<string, string[]> }`. Для `choice` — синоніми на кожен id.
  - `normalizeAnswer(spec: AnswerSpec, raw: string): string | null` — канонічний рядок або `null`.
  - `acceptedCanon(spec: AnswerSpec): string[]` — усі канонічні правильні значення.
  - `normalizeCode(raw: string): number | null` — «АС-114», «ac 114», «114», URL з `/code/114` → `114`.
  - `hashAnswer(salt: string, canon: string): Promise<string>` — SHA-256 hex.
  - `sealWithAnswers(payload: unknown, salt: string, accepted: string[]): Promise<Sealed>`, де `Sealed = { salt: string; wraps: Record<string, string>; box: string }` (ключ — hash; значення — обгорнутий ключ AES-GCM; `box` — base64 iv‖ciphertext).
  - `openSealed(sealed: Sealed, canon: string): Promise<unknown | null>`.
  - `obfuscate(s: string): string` / `deobfuscate(s: string): string` — XOR із фіксованим ключем + base64 (лише щоб текст не читався в джерелі).

- [ ] **Step 1: Write failing tests** у `shared/answers.test.ts`:
  - `number`: спека `{min:1.6,max:1.9,step:0.1}` — `'1,8'→'1.8'`, `'1.8 м/с'→'1.8'`, `' 1.75'→'1.8'`, `'18'→'18'` (нормалізується, але не входить у `acceptedCanon`), `'abc'→null`; `acceptedCanon` = `['1.6','1.7','1.8','1.9']`.
  - `time`: спека `{min:'00:35',max:'00:45'}` — `'0:40'`, `'00.40'`, `'0040'`, `'00 40'` → `'00:40'`; `acceptedCanon` має 11 значень.
  - `choice`: `{options:{korzh:['корж','давид корж','корж давид']}}` — `'Корж'`, `' давид  КОРЖ '` → `'korzh'`; апостроф і регістр не важать.
  - `normalizeCode`: `'АС-114'`, `'AC114'`, `'ас 114'`, `'https://x.github.io/app/#/code/114'` → `114`; `'АС-'` → `null`.
- [ ] **Step 2:** `npx vitest run shared` → FAIL (модулів немає).
- [ ] **Step 3: Implement `shared/answers.ts`.** Числа: заміна коми, відкидання всього після першого числа, округлення до `step` (рядок без зайвих нулів). Час: дві групи цифр → `HH:MM`. Choice: lower-case, згорнуті пробіли, прибрані `'’ʼ`.
- [ ] **Step 4: Write failing tests** у `shared/seal.test.ts`:
  - `sealWithAnswers({x:1}, 'g-a', ['1.7','1.8'])`, потім `openSealed(s,'1.8')` → `{x:1}`, `openSealed(s,'1.5')` → `null`;
  - `JSON.stringify(sealed)` не містить `'1.8'` і `'"x"'`;
  - `deobfuscate(obfuscate('Корж'))==='Корж'` і `obfuscate('Корж')` не містить `'Корж'`.
- [ ] **Step 5: Implement `shared/seal.ts`** на `globalThis.crypto.subtle`, щоб працювало і в Node, і в браузері. Випадковий ключ AES-GCM 256 шифрує `box`. Для кожної прийнятої відповіді ключ обгортається ключем PBKDF2(SHA-256, 50 000 ітерацій, salt) від канонічного рядка. `wraps` індексовано `hashAnswer(salt, canon)`.
- [ ] **Step 6:** `npx vitest run shared` → PASS.
- [ ] **Step 7: Commit** `feat(shared): answer normalization and sealed gate payloads`.

### Task 2: Вміст акту 1 і збирання `case.json`

**Files:**
- Create: `shared/case-types.ts`, `content/cases/astrolabe/case.yaml`, `content/cases/astrolabe/geometry.yaml`, `content/cases/astrolabe/uk/act1.yaml`, `tools/build-content.ts`, `tools/build-content.test.ts`
- Modify: `package.json` (dep `yaml@^2`; скрипти `content` = `node --experimental-strip-types tools/build-content.ts`, `predev`/`prebuild` у app викликають `content`), `.gitignore` (`app/src/generated/`)

**Interfaces:**
- Consumes: Task 1 (`AnswerSpec`, `sealWithAnswers`, `obfuscate`, `acceptedCanon`).
- Produces (`shared/case-types.ts`):
  - `Level = 'trainee' | 'detective'`; `Mode = 'competition' | 'departments'`.
  - `CaseDoc = { id: string; title: string; medium: 'paper' | 'app'; section: 'start'|'A'|'B'|'C'|'D'; sheet?: number; dept?: 'K'|'A'|'O'; component: string; props: Record<string, unknown>; levels?: Partial<Record<Level, Record<string, unknown>>> }`.
  - `TaskDef = { id: string; title: string; gate?: 'A'|'B'|'C'|'D'; optional?: boolean; spec: Record<Level, AnswerSpec>; hints: Record<Level, [string, string, string]> }`. Після збирання: `spec` → `check: Record<Level, { salt: string; hashes: string[] }>`, хеші не обфускуються; підказки обфусковані.
  - `DecisionDef = { id: string; prompt: string; options: { id: string; label: string; effects: Effect[]; requires?: Condition }[]; defaultOption?: string; deadlineGate?: string }`.
  - `Effect = { set: string; value: boolean | number | string } | { penaltyMin: number } | { unlock: string } | { schedule: string; afterMin: number }`.
  - `Condition = { flag: string; equals?: unknown } | { decided: string; option: string } | { all: Condition[] } | { any: Condition[] }`.
  - `EventDef = { id: string; at: { minute?: number; afterGate?: string; afterEvent?: string; plusMin?: number; onCode?: number[] }; messageId: string; decision?: string }`.
  - `CodeDef = { code: number; action: { interview: string } | { decision: string } | { task: string } | { doc: string } | { start: true } }`.
  - `CaseBundle = { id; title; docs: CaseDoc[]; tasks: TaskBuilt[]; decisions; events; codes; messages: Record<string, string>; interviews: Record<string, { quotaCost: 1; lines: { who: string; text: string }[] }>; gates: Record<'A'|'B'|'C'|'D', { task: string; sealed: Record<Level, Sealed> }>; geometry }` — усі текстові поля обфусковані.
  - `buildCase(dir: string): Promise<CaseBundle>`; CLI пише `app/src/generated/case.json`.
  - `validateCase(bundle): string[]` — список помилок (порожній = ок).

- [ ] **Step 1: Write the content** (за біблією, розділи 3–9; числа — з `node tools/solve.mjs --json`):
  - `case.yaml`:
    - задачі З-1 (шлюз А; стажер і слідчий — число `{1.6..1.9, step 0.1}`) і З-2 (необов'язкова; choice `korzh`);
    - рішення Р1 (а/б/в з ефектами з розділу 9: `bayda_alert`, `interviewQuota` 2/2/1, `penaltyMin 5` для «б», `unlock: Ц-02` / `Ц-02б`, `schedule: E1-reopen` через 3 хв для «б») і Р2 (квота);
    - подія Е1 (`minute: 8`, `onCode: [114,115,116,117]`) і `E1-reopen`;
    - коди 000, 114–117, 190;
    - документи розділу 6.2 для стартового конверта (паперові з `sheet`, цифрові 1-09, 1-11, Ц-01, Ц-02, Ц-02б);
    - вміст шлюзу А = повідомлення «Відкрийте конверт А» + порожній розділ архіву A (зріз закінчується тут).
  - `uk/act1.yaml`: брифінг слідчої Крук (П-02) з біографією Ореста; дзвінок Е1 (07:15) + голосове Байди; чотири допити Ц-03…06 (зміст і обмовки — таблиця Р2 біблії; Корж не згадує підміну); екрани «справу закрито» й повторного відкриття; вирізка 1-09 з програмою свята (23:00–23:20 феєрверк, 23:05–23:20 нагородження, 23:30–00:30 концерт); фотозвіт 1-11 з мітками до секунди з `solve.mjs → trap2317`; по три підказки для З-1 і З-2 на кожен рівень (напрям → документ → розв'язок); реакція на З-2 «Чисто. Занадто чисто».
  - `geometry.yaml`: план Ринку з `solve.mjs → square`; місто — точки в метрах:
    - вежа (0;0), сцена (−300;335), ресторан (420;323), балкон готелю (−150;−161), крамниця (636;−636), натовп (−320;344);
    - квартира Ореста — 400 м;
    - дім Прокопчук і дві ламані маршрутів довжиною 1,3 км (через парк) і 1,9 км (в обхід, повз Старий став);
    - стрілка «до вокзалу 2,4 км»;
    - широта 49°25′ на полях, години парку 07:00–24:00.
- [ ] **Step 2: Write failing tests** у `tools/build-content.test.ts`:
  - `validateCase(await buildCase('content/cases/astrolabe'))` → `[]`;
  - коди унікальні;
  - кожен `doc` у ефектах і подіях існує;
  - паперових аркушів у маніфесті ≤ 25, номери 01–12 присутні;
  - відстані з `geometry` до вежі збігаються з `solve.mjs → trap2317.people` (±5 м), довжини маршрутів 1,3 і 1,9 км (±0,05);
  - `JSON.stringify(bundle)` не містить `'1.8'`, `'Прокопчук о 00:42'` і `'korzh'`;
  - `openSealed(bundle.gates.A.sealed.trainee, '1.8')` → не `null`.
- [ ] **Step 3:** `npx vitest run tools` → FAIL.
- [ ] **Step 4: Implement `tools/build-content.ts`** (yaml → типи → обфускація текстів → хеші відповідей → запечатаний вміст шлюзів → `validateCase`). Невдала валідація = код виходу 1 із переліком помилок.
- [ ] **Step 5:** `npx vitest run tools && npm run content` → PASS, файл `app/src/generated/case.json` створено.
- [ ] **Step 6: Commit** `feat(content): act 1 case content and build pipeline`.

### Task 3: Рушій гри

**Files:**
- Create: `app/src/engine/state.ts`, `reducer.ts`, `events.ts`, `storage.ts`, `conditions.ts`, `engine.test.ts`

**Interfaces:**
- Consumes: Task 2 (`CaseBundle` та інші типи), Task 1 (`normalizeAnswer`, `hashAnswer`, `openSealed`).
- Produces:
  - `GameState = { version: 1; caseId: string; level: Level; mode: Mode; team: string; startedAt: number; penaltyMin: number; flags: Record<string, unknown>; decisions: Record<string, string>; interviewsDone: string[]; interviewQuota: number; solved: Record<string, { canon: string; at: number }>; hintsUsed: Record<string, number>; firedEvents: string[]; scheduled: { event: string; dueAt: number }[]; unlocked: string[]; inbox: { id: string; messageId: string; at: number; read: boolean }[]; gatePayloads: Record<string, unknown> }`.
  - `type Action = { type: 'start'; level; mode; team; now } | { type: 'decide'; decision: string; option: string; now } | { type: 'interview'; id: string; now } | { type: 'hint'; task: string; now } | { type: 'solved'; task: string; canon: string; payload?: unknown; now } | { type: 'tick'; now } | { type: 'read'; inboxId: string } | { type: 'reset' }`.
  - `reduce(bundle: CaseBundle, s: GameState | null, a: Action): GameState`.
  - `checkAnswer(bundle, s, task: string, raw: string): Promise<{ ok: boolean; canon: string | null; payload?: unknown }>` — асинхронна перевірка поза редʼюсером; при `ok` UI диспатчить `solved`.
  - `elapsedMin(s, now): number` — реальний час + штрафи.
  - `dueEvents(bundle, s, now): string[]`.
  - `interviewStatus(s, id): 'available' | 'needsE1' | 'quotaUsed' | 'done'`.
  - `load(): GameState | null` / `save(s): boolean` — `false`, якщо сховище недоступне.

- [ ] **Step 1: Write failing tests** (`engine.test.ts`, фіксований `now`, фікстура — зібраний `case.json`):
  - `E1 fires at minute 8`: після `start` `tick` на 7:59 → немає Е1 у `inbox`; на 8:00 → є.
  - `interview before E1 fires E1`: `interview 114` до 8 хв → Е1 у `inbox`, допит не зарахований, статус `needsE1`.
  - `R1 quotas`: «а» → квота 2; «в» → 1; третій допит при квоті 2 → статус `quotaUsed`, `interviewsDone.length===2`.
  - `R1 close path`: «б» → `penaltyMin===5`, `flags.case_closed===true`; через 3 хв `tick` → подія `E1-reopen`, `case_closed===false`, у `unlocked` є `Ц-02б`, немає `Ц-02`.
  - `hint penalty`: дві підказки до З-1 → `hintsUsed['З-1']===2`, `elapsedMin` +6 (3 хв за підказку [моє рішення]).
  - `gate A solve`: `checkAnswer(...,'З-1','1,8')` → `ok`, після `solved` у `unlocked` є `section:A`, у `gatePayloads.A` — повідомлення про конверт А.
  - `wrong answer`: `'0.6'` → `ok:false`, стан без змін.
  - `restores after reload`: `save(s)`, потім `load()` → `deepEqual`.
  - `storage throws`: замінений `localStorage.setItem`, що кидає → `save` повертає `false`, без винятку.
  - `deadline default`: шлюз А розв'язано без вибору в Р2 → нічого не ламається; Р1 без вибору до шлюзу А → застосовано варіант за замовчуванням «а».
- [ ] **Step 2:** `npx vitest run app/src/engine` → FAIL.
- [ ] **Step 3: Implement** reducer (чистий, `now` лише з дії), `conditions.ts` (оцінка `Condition`), `events.ts` (`dueEvents` за `minute` / `afterGate` / `afterEvent+plusMin` / `scheduled`), `storage.ts` (ключ `astrolabe:v1`, try/catch).
- [ ] **Step 4:** тести → PASS.
- [ ] **Step 5: Commit** `feat(engine): game state reducer, timed events, persistence`.

### Task 4: Документи та SVG-карти

**Files:**
- Create:
  - `app/src/documents/` — `Paper.tsx` (обгортка «аркуш паперу» з фактурою, штампом), `Protocol.tsx` (1-01), `ExpertReport.tsx` (1-05 + таблиця 1-08), `PhotoPrint.tsx` (фото 10×15 з підписом / Instagram-рамкою), `Clipping.tsx` (1-09), `PhotoReport.tsx` (1-11), `DossierCard.tsx` (А6 з фото, даними, QR), `BriefingLetter.tsx` (П-02), `RulesCard.tsx`, `CipherDisk.tsx`, `TaskSheet.tsx`, `index.ts` (реєстр `component` → React-компонент)
  - `app/src/maps/` — `TownMap.tsx` (1:10 000), `SquarePlan.tsx` (1:1 000), `TowerSection.tsx` (1-06 + специфікація 1-07), `scale.ts`, `maps.test.ts`
  - `app/src/ui/qr.tsx` (QR-компонент на `qrcode`)

**Interfaces:**
- Consumes: Task 2 (`CaseDoc`, `geometry`), Task 1 (`deobfuscate`).
- Produces:
  - `renderDoc(doc: CaseDoc, level: Level, ctx: { print: boolean; baseUrl: string }): JSX.Element`.
  - `mmPerMeter(scale: number): number`; `TownMap({ geometry, print })` і `SquarePlan({ geometry, print })` малюють у міліметрах при `print`.

- [ ] **Step 1: Write failing tests** (`maps.test.ts`): у відрендереному SVG `TownMap` відстань між центрами маркерів «вежа» і «сцена» дорівнює 45,0 мм (±0,3) при масштабі 1:10 000; на `SquarePlan` двері музею — вежа: 60 мм (±0,3); масштабна лінійка 100 м = 10 мм / 10 мм.
- [ ] **Step 2:** FAIL → **Step 3:** реалізувати компоненти. Стиль: друкарський шрифт протоколів (Courier Prime), рукописні вставки (Caveat; обидва шрифти — з Google Fonts, для друку — локальні копії в `app/public/fonts/`), штампи, кавова пляма на 2-02 (на майбутнє). Розмір у мм при `print`; на екрані — масштабується за шириною. → **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(documents): act 1 document components and measured maps`.

### Task 5: Застосунок акту 1

**Files:**
- Create: `app/src/ui/` — `router.ts` (`useHashRoute()`), `App.tsx` (замінює заглушку), `Setup.tsx`, `Dashboard.tsx` (таймер, вхідні, «Ввести код», «Сканувати», архів, завдання), `CodeEntry.tsx`, `Scanner.tsx` (`qr-scanner`), `Archive.tsx`, `DocView.tsx` (масштабування щипком / кнопками), `TaskScreen.tsx` (поле відповіді, підказки з підтвердженням штрафу), `DecisionScreen.tsx`, `InterviewScreen.tsx`, `CaseClosed.tsx`, `EnvelopeScreen.tsx` («Відкрийте конверт А»), `useGame.ts` (стан + `tick` щосекунди + `save`), `ui.test.tsx`
- Modify: `app/src/main.tsx`, `app/src/index.css` (токени кольорів, світла/темна тема), `app/package.json` (deps `qr-scanner@^1.4`, `qrcode@^1.5`; dev-deps `@testing-library/react`, `jsdom`)

**Interfaces:**
- Consumes: Task 3 (`reduce`, `checkAnswer`, `load`, `save`, `interviewStatus`, `elapsedMin`), Task 4 (`renderDoc`).
- Produces: маршрути `#/`, `#/setup`, `#/case`, `#/code/:n`, `#/scan`, `#/archive`, `#/doc/:id`, `#/task/:id`, `#/decision/:id`, `#/interview/:id`, `#/envelope/:id`.

- [ ] **Step 1: Write failing tests** (`ui.test.tsx`, Vitest + `@testing-library/react` + jsdom):
  - `code before start`: маршрут `#/code/114` без стану → екран «Почати розслідування?», після старту — екран допиту або «спершу рішення» (Е1);
  - `code entry normalizes`: введення «ас 190» відкриває `#/task/З-1`;
  - `unknown code`: «АС-999» → «Такого коду в справі немає», без зміни стану;
  - `gate A flow`: відповідь «1,8» → `#/envelope/A`.
- [ ] **Step 2:** FAIL → **Step 3:** реалізувати.
  - Таймер — «Час розслідування ММ:СС» з урахуванням штрафів.
  - Вхідні — сповіщення про події.
  - Підказка спершу питає «−3 хв. Показати?».
  - Сканер просить дозвіл на камеру, а за відмови показує поле коду.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(app): act 1 playable flow`.

### Task 6: Друк аркушів 01–12

**Files:**
- Create: `app/print.html`, `app/src/print/PrintKit.tsx` (читає `?level=`, рендерить аркуші за маніфестом), `app/src/print/sheets.tsx` (розкладка кожного аркуша: А4, А5+А5, 2×10×15, 4×А6), `app/src/print/print.css` (`@page { size: A4; margin: 0 }`, лінії різу), `tools/build-print.ts`
- Modify: `app/vite.config.ts` (multi-page input), `package.json` (dev-dep `playwright-core`; скрипт `print` = `vite build` → `vite preview` → `build-print.ts`)

**Interfaces:**
- Consumes: Task 4 (`renderDoc`), Task 2 (маніфест аркушів), env `PUBLIC_APP_URL` для QR (за замовчуванням `https://example.github.io/astrolabe/` — замінимо при розгортанні).

- [ ] **Step 1:** `tools/build-print.ts`:
  - запускає Edge (`chromium.launch({ channel: 'msedge' })`);
  - для `trainee` і `detective` відкриває `print.html?level=…`;
  - чекає завантаження шрифтів і зображень;
  - зберігає `page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })` у `print/out/kit-<level>.pdf`.
- [ ] **Step 2:** Перевірки в тому ж скрипті (код виходу 1, якщо не так):
  - у PDF рівно 12 сторінок;
  - кожен QR на сторінці декодується (`qr-scanner` у Node не працює — декодувати скриншоти сторінок через `jsqr`, dev-dep) і веде на `#/code/<n>` із маніфесту;
  - рядок «1647» не з'являється в тексті сторінок.
- [ ] **Step 3:** `npm run print` → два PDF по 12 сторінок, перевірки зелені.
- [ ] **Step 4: Commit** `feat(print): A4 kit sheets 01–12 with QR codes`.

### Task 7: Фото акту 1

**Files:**
- Create: `assets/prompts/act1.md` (промпт і вимоги до кожного кадру), `app/public/img/` — `1-02-clock.jpg`, `1-03-watch.jpg`, `1-04-square.jpg`, `1-10-fireworks-a.jpg`, `1-10-fireworks-b.jpg`, `p-orest.jpg`, `p-zgurska.jpg`, `p-prokopchuk.jpg`, `p-luhovyi.jpg`, `p-korzh.jpg`, `c-02-paving.jpg`

- [ ] **Step 1: Write prompts** (стиль: документальне фото, смартфон або службова камера, Україна 2020-х, без брендів і тексту). Обов'язкові деталі:
  - 1-02 — циферблат вежі з римськими цифрами, 23:17 (стрілки дорисувати SVG-накладкою, якщо модель помиляється);
  - 1-03 — чоловічий механічний годинник із розбитим склом на бруківці, 23:17;
  - 1-04 — площа на світанку, тіло під сірим покривалом, видно лише черевик на краю кадру, мокра плитка 40×40;
  - 1-10 — вежа з циферблатом і феєрверк здалеку, телеоб'єктив; біля дверей маленька постать у капелюсі; другий кадр — лише небо;
  - портрети: вік, зовнішність і одяг з розділу 3 біблії, однакове світло, формат «фото для досьє». Спершу генерується еталонний портрет кожного персонажа, наступні кадри робляться з ним як референсом;
  - Ц-02 — вигляд згори на сіру плитку 40×40 (рівна сітка); крейдяна позначка й жовтий маркер «1» накладаються в SVG точно на дальній край 9-ї плитки від лінії карниза.
- [ ] **Step 2: Generate.** Gemini (вбудований браузер, `gemini.google.com`) або ChatGPT. Завантаження без окремого підтвердження дозволено користувачем. Зберегти в `app/public/img/`, стиснути до ≤ 400 КБ (`sips -Z 1600`).
- [ ] **Step 3: Перевірка кожного кадру очима:**
  - 16+ (нічого, крім черевика й покривала);
  - на годинниках 23:17 (або накладка);
  - жодного читабельного тексту чи логотипу;
  - портрети відповідають віку і статі персонажа.
- [ ] **Step 4: Commit** `feat(assets): act 1 photos and prompts`.

### Task 8: Наскрізна перевірка зрізу

**Files:**
- Create: `tools/e2e-act1.ts` (Playwright через Edge, мобільний viewport 375×812 і мультиборд 1920×1080)

- [ ] **Step 1:** Сценарій «Стажер, Р1-а»:
  - старт;
  - очікування Е1 (у тесті годинник підміняється через `page.clock`);
  - Р1-а;
  - допити 114 і 117, третій (115) → відмова;
  - З-2 «корж» → «Чисто. Занадто чисто»;
  - одна підказка З-1;
  - відповідь «1,8» → екран конверта А;
  - перезавантаження сторінки → стан збережено.
- [ ] **Step 2:** Сценарій «Слідчий, Р1-б»:
  - «справу закрито»;
  - +3 хв → повторне відкриття;
  - штраф 5 хв видно в таймері;
  - в архіві Ц-02б, а не Ц-02.
- [ ] **Step 3:** Скриншоти ключових екранів у `print/out/screens/`. Перевірка: немає горизонтального прокручування на 360 px, у консолі немає помилок.
- [ ] **Step 4:** Перегляд обох PDF посторінково (рендер у PNG і огляд). Окремий чек на «16+» і на читабельність дрібного тексту при друці.
- [ ] **Step 5: Commit** `test(e2e): act 1 playthrough on mobile and multiboard`.

---

## Що свідомо НЕ входить у зріз

Акти 2–4, режим ведучого, мультиборд-вкладки команд, кодові слова для синхронізації телефонів, режим «Відділи», епілог, розгортання на GitHub Pages — наступні етапи загального плану.
