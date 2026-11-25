// Посібник ведучого паперової партії, правила для гравців, бланк звинувачення й протокол партії.
import { Paras } from '../documents/context.tsx';
import type { Dept } from '../../../shared/case-types.ts';
import { acceptText, DEPT_LETTERS, DEPT_NAMES, docLabel, LEVELS, paper } from './data.ts';
import { optLetter } from './Kit.tsx';
import { ASTROLABE_POINTS, KILLER_POINTS, KORZH_POINTS, STEPAN_POINTS } from './epilogue.ts';
import '../documents/documents.css';
import '../print/guide.css';
import './paper.css';

const envName = (id: string) => paper.envelopes.find((e) => e.id === id)!;
const sheetsOf = (id: string) => envName(id).sheets.map((s) => s.number);
const range = (ns: number[]) => (ns.length > 1 ? `${ns[0]}–${ns[ns.length - 1]}` : String(ns[0]));
const TOTAL = paper.envelopes.reduce((a, e) => a + e.sheets.length, 0);

/** Тексти розбору, що в паперовій партії звучать інакше (немає З-7, З-9). */
const REVIEW_PAPER: Record<string, string> = {
  schemeProof2:
    'Байду ви назвали, але він був насторожі й устиг знищити папери — суду бракувало другого доказу. Їх давали угода зі Згурською, затриманий Вейс і викритий сержант Дорош.',
  schemeProof: 'Байду ви назвали, але доказів не було.',
};

export function HostGuide() {
  return (
    <article className="guide paper-guide" data-ready="1">
      <header className="guide__cover">
        <p className="guide__case">{paper.caseTitle}</p>
        <h1>Посібник ведучого</h1>
        <p className="paper-guide__sub">{paper.subtitle}</p>
        <p className="guide__warn">Не показуйте гравцям: тут розгадка й усі відповіді.</p>
        <Paras text={paper.host.role} />
      </header>

      <section>
        <h2>Що надрукувати</h2>
        <table>
          <thead>
            <tr>
              <th>Файл</th>
              <th>Скільки</th>
              <th>Для чого</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Комплект «Стажер» або «Слідчий»</td>
              <td>1 на команду (у «Відділах» — 1 на всіх)</td>
              <td>{TOTAL} аркушів А4: папка і 4 конверти</td>
            </tr>
            <tr>
              <td>Пачка ведучого того самого рівня</td>
              <td>1 на команду</td>
              <td>картки шлюзів, подій, рішень, наслідків, підказок, наклейки; документи, що видаються за рішеннями</td>
            </tr>
            <tr>
              <td>Бланки</td>
              <td>1 на команду</td>
              <td>бланк звинувачення (гравцям) і протокол партії з розрахунком епілогу (ведучому)</td>
            </tr>
            <tr>
              <td>Правила гри</td>
              <td>1 на команду</td>
              <td>без спойлерів, можна роздати заздалегідь</td>
            </tr>
            <tr>
              <td>Цей посібник</td>
              <td>1</td>
              <td>ведучому</td>
            </tr>
          </tbody>
        </table>
        <h3>Підготовка</h3>
        <p>
          Друк односторонній, масштаб 100 % (не «Підігнати до сторінки»). Колір кращий для фото, але чорно-білий теж годиться. Лінії різу — пунктир: фото, картки
          фігурантів, половинки аркушів, картки ведучого (6 на аркуші). Шифрувальний диск (аркуш 3): виріжте обидва кола й скріпіть по центру.
        </p>
        <p>
          Чотири конверти C5 на команду з наклейками з пачки ведучого: «Старт», «А», «Б», «В». Папку й стартовий конверт кладіть на стіл; конверти А, Б, В тримайте в
          себе. Картки розкладіть стосиками: шлюзи, події, рішення, наслідки (по рішеннях), підказки (по завданнях, 1 → 3), документи за рішеннями. Потрібен таймер на 40
          хвилин, видимий усім.
        </p>
        <table>
          <thead>
            <tr>
              <th>Що</th>
              <th>Аркуші</th>
              <th>Коли</th>
            </tr>
          </thead>
          <tbody>
            {paper.envelopes.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{e.title}</strong>
                </td>
                <td>{range(sheetsOf(e.id))}</td>
                <td>{e.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="paper-guide__contents">
          <tbody>
            {paper.envelopes.map((e) => (
              <tr key={e.id}>
                <td>{e.label}</td>
                <td>{e.sheets.flatMap((s) => s.docs.map((d) => `${d.label} ${d.title}`)).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Режими гри</h2>
        <Paras text={paper.host.competition} />
        <Paras text={paper.host.departments} />
        <div className="guide__depts">
          {(['K', 'A', 'O'] as Dept[]).map((d) => (
            <div key={d}>
              <h3>
                {DEPT_LETTERS[d]} · {DEPT_NAMES[d]}
              </h3>
              <ul>
                {paper.envelopes.flatMap((e) =>
                  e.sheets.flatMap((s) =>
                    s.docs
                      .filter((x) => x.dept === d)
                      .map((x) => (
                        <li key={x.id}>
                          {e.label} · арк. {s.number} · {x.label} {x.title}
                        </li>
                      )),
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
        <table>
          <thead>
            <tr>
              <th>Завдання</th>
              <th>Чиї висновки потрібні у «Відділах»</th>
            </tr>
          </thead>
          <tbody>
            {paper.tasks.map((t) => (
              <tr key={t.id}>
                <td>
                  {t.label} {t.title}
                </td>
                <td>{(t.depts ?? []).map((d) => DEPT_NAMES[d]).join(' + ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Брифінг</h2>
        <Paras text={paper.host.briefing} />
      </section>

      <section>
        <h2>Сценарій на 40 хвилин</h2>
        <table>
          <thead>
            <tr>
              <th>Хв</th>
              <th>Етап</th>
              <th>Видати</th>
            </tr>
          </thead>
          <tbody>
            {paper.timeline.map((r) => (
              <tr key={r.when}>
                <td>{r.when}</td>
                <td>
                  <strong>{r.stage}</strong>
                  <div>{r.what}</div>
                </td>
                <td>{r.give}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Контрольні точки</h3>
        <p>
          {paper.checkpoints.map((c) => `шлюз ${envName(c.gate).label} — до ${c.by}-ї хв`).join('; ')}. {paper.host.stuck}
        </p>
        <h3>Перевірка відповідей</h3>
        <p>
          Порівнюйте з колонкою «Приймати» нижче: межі включно, кома чи крапка — неважливо. Кажіть лише «так» або «ні». {paper.wrongRule} Правильно — прочитайте картку
          шлюзу (або «розв'язано»), видайте конверт і запишіть хвилину в протокол.
        </p>
      </section>

      <section className="guide__break">
        <h2>Події</h2>
        <table>
          <thead>
            <tr>
              <th>Коли</th>
              <th>Подія</th>
              <th>Що зробити</th>
            </tr>
          </thead>
          <tbody>
            {paper.events.map((e) => (
              <tr key={e.id}>
                <td>{e.when}</td>
                <td>
                  <strong>{e.id}</strong> <span className="guide__muted">{e.text.split('\n')[0]}</span>
                </td>
                <td>{e.then}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Рішення і наслідки</h2>
        <p>
          Команда називає літеру — прочитайте картку наслідку цього варіанта й видайте документ, якщо він указаний. Не встигли до дедлайну — застосуйте варіант за
          замовчуванням. У «Відділах» — голосування відділів.
        </p>
        {paper.decisions.map((d) => (
          <div className="guide__task" key={d.id}>
            <h3>
              {d.label}. {d.prompt}
            </h3>
            <p className="guide__muted">
              Коли: {d.given}
              {d.deadline && ` · дедлайн: ${d.deadline}`}
              {d.default && ` · за замовчуванням: «${optLetter(d, d.default)}»`}
            </p>
            <table>
              <tbody>
                {d.options.map((o) => (
                  <tr key={o.id}>
                    <td className="paper-guide__opt">
                      <strong>{optLetter(d, o.id)})</strong> {o.label}
                    </td>
                    <td>
                      {o.note && <div>{o.note}</div>}
                      {o.give?.length ? <div>Видати: {o.give.map(docLabel).join(', ')}</div> : null}
                      {!o.note && !o.give?.length && <span className="guide__muted">лише картка наслідку</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section className="guide__break">
        <h2>Відповіді й розв'язки</h2>
        {paper.tasks.map((t) => (
          <div className="guide__task paper-guide__answer" key={t.id}>
            <h3>
              {t.label}. {t.title}
              {t.gate && ` · шлюз → конверт ${envName(paper.gates[t.gate].envelope).label}`}
              {t.branch && ' · термінове (гілка отруєння)'}
            </h3>
            <table>
              <thead>
                <tr>
                  <th />
                  {LEVELS.map(([l, n]) => (
                    <th key={l}>{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Питання</td>
                  {LEVELS.map(([l]) => (
                    <td key={l}>{t.question[l]}</td>
                  ))}
                </tr>
                <tr className="paper-guide__accept">
                  <td>Приймати</td>
                  {LEVELS.map(([l]) => (
                    <td key={l}>
                      <strong>{acceptText(t, l)}</strong>
                    </td>
                  ))}
                </tr>
                {[0, 1, 2].map((i) => (
                  <tr key={i}>
                    <td>{i === 2 ? 'Підказка 3 = розв’язок' : `Підказка ${i + 1}`}</td>
                    {LEVELS.map(([l]) => (
                      <td key={l}>{t.hints[l][i]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section className="guide__break">
        <h2>Розгадка</h2>
        <Paras text={paper.host.solution} />
        <h3>Правильне звинувачення</h3>
        <table>
          <tbody>
            {paper.accusation.map((q) => (
              <tr key={q.id}>
                <td>{q.prompt}</td>
                <td>
                  <strong>{q.options.find((o) => o.id === q.answer)?.label}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="guide__break">
        <h2>Епілог: як порахувати</h2>
        <p>Заповніть розрахунок у протоколі партії команди (бланки), крок за кроком. Потім прочитайте відповідні рядки нижче — це газета «рік по тому».</p>
        <EpilogueSteps />
        <h2>Тексти епілогу</h2>
        <p className="guide__muted">{paper.epi.title}</p>
        <EpiTable
          rows={[
            ['Заголовок: засуджена', paper.epi['headline.convicted']],
            ['Заголовок: виправдана', paper.epi['headline.acquitted']],
            ['Заголовок: втекла', paper.epi['headline.escaped']],
            ['Заголовок: не названо', paper.epi['headline.unnamed']],
            ['Заголовок: засуджено Коржа', paper.epi['headline.innocent']],
            ['Заголовок: нещасний випадок', paper.epi['headline.accident']],
            ['Вбивця засуджена', paper.epi['killer.convicted']],
            ['Вбивця виправдана', paper.epi['killer.acquitted']],
            ['Вбивця втекла', paper.epi['killer.escaped']],
            ['Вбивцю не названо / нещасний випадок', paper.epi['killer.unnamed']],
            ['Засуджено невинного (Коржа)', paper.epi.innocent],
            ['Астролябія в музеї', paper.epi['astrolabe.museum']],
            ['Астролябія схована', paper.epi['astrolabe.hidden']],
            ['Астролябія за кордоном', paper.epi['astrolabe.abroad']],
            ['Луговий живий', paper.epi['stepan.alive']],
            ['Луговий у лікарні', paper.epi['stepan.hospital']],
            ['Луговий утік', paper.epi['stepan.fled']],
            ['Луговий загинув', paper.epi['stepan.dead']],
            ['Корж вільний', paper.epi['korzh.free']],
            ['Корж довго під вартою', paper.epi['korzh.detained']],
            ['Схему викрито', paper.epi['scheme.exposed']],
            ['Схема прихована', paper.epi['scheme.hidden']],
            ['Гайовий — рятівник', paper.epi['orest.hero']],
            ['Гайовий під підозрою', paper.epi['orest.shadow']],
            ['Ірина (завжди)', paper.epi['iryna.safe']],
            ['Соломія (завжди)', paper.epi['solomiya.other']],
            ['Дорош викритий (Р7 «а» або «б»)', paper.epi['dorosh.exposed']],
            ['Дорош не викритий', paper.epi['dorosh.promoted']],
            ['Згурська: Р8 «а»', paper.epi['marta.deal']],
            ['Згурська: Р8 «б»', paper.epi['marta.charged']],
            ['Згурська: Р8 «в»', paper.epi['marta.free']],
          ]}
        />
        <h3>{paper.epi['review.title']}: що сказати команді</h3>
        <EpiTable
          rows={[
            ['Не засуджено й З-5 не розв’язано', paper.epi['review.missShadow']],
            ['Не засуджено й З-6 не розв’язано', paper.epi['review.missLedger']],
            ['Не засуджено й Р5 не «а»/«б»', paper.epi['review.missWitness']],
            ['Р7 = «в» (витік)', paper.epi['review.leak']],
            ['Втекла на вокзал', paper.epi['review.alert']],
            ['Корж лишився під вартою', paper.epi['review.korzh']],
            ['Вбивця втекла', paper.epi['review.wrongPlace']],
            ['Байду не названо', paper.epi['review.schemeName']],
            ['Байду названо, доказів схеми < 2', REVIEW_PAPER.schemeProof2],
            ['Луговий загинув', paper.epi['review.stepanDead']],
          ]}
        />
      </section>

      <section>
        <h2>Що змінено проти повної гри</h2>
        <Paras text={paper.host.cut} />
      </section>
    </article>
  );
}

function EpiTable({ rows }: { rows: [string, string][] }) {
  return (
    <table className="paper-guide__epi">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td>{k}</td>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const STEPS: [string, string][] = [
  ['1. Де Прокопчук під час операції', 'У вежі — якщо Р7 = «в» (витік) і З-11 розв’язано. Інакше на вокзалі — якщо Р5 = «а» або «б», або Р7 = «б» (її злякали). Інакше — вдома.'],
  ['2. Де Вейс', 'Під вартою — якщо Р7 = «б». Інакше на вокзалі — якщо Прокопчук на вокзалі. Інакше — у крамниці.'],
  ['3. Докази проти Прокопчук', 'Порахуйте: З-5 розв’язано; З-6 розв’язано; Р5 = «а» або «б» (свідчення / запис Лугового); Вейс під вартою або група поїхала туди, де він (телефон Вейса); Р5 = «б» або «в» (токсикологія).'],
  [
    '4. Вбивця',
    `Названо Прокопчук: якщо вона вдома або туди, де вона, поїхала група — доказів ≥ 2 → засуджена (+${KILLER_POINTS.convicted}), інакше виправдана (+${KILLER_POINTS.acquitted}); якщо групи там нема — втекла (+${KILLER_POINTS.escaped}). Названо Коржа → засуджено невинного (${KILLER_POINTS.innocent}). Інше → 0.`,
  ],
  ['5. Астролябія', `Вивезена (${ASTROLABE_POINTS.abroad}) — якщо Р7 = «в», З-11 розв’язано і жодна група не у вежі. Інакше у музеї (+${ASTROLABE_POINTS.museum}) — якщо місце названо правильно або група у вежі. Інакше схована (+${ASTROLABE_POINTS.hidden}).`],
  ['6. Луговий', `Р5 «а» → живий (+${STEPAN_POINTS.alive}); «г» → утік (+${STEPAN_POINTS.fled}); «б» або «в» → З-10 вчасно — у лікарні (+${STEPAN_POINTS.hospital}), інакше загинув (0).`],
  ['7. Корж', `Названо вбивцею → засуджений (${KORZH_POINTS.convicted}). Р3 = «а» і не звільнено (Р3+) → під вартою (+${KORZH_POINTS.detained}). Інакше вільний (+${KORZH_POINTS.free}).`],
  ['8. Схема', 'Викрито (+15) — якщо Байду названо організатором і доказів схеми щонайменше два: Р8 = «а»; Вейс під вартою або група там, де він; Дорош викритий (Р7 = «а» або «б»). Інакше 0.'],
  ['9. Гайовий', 'Друге питання (хто зняв оригінал) — Гайовий → +5.'],
  ['10. Час', '40 − (хвилина звинувачення + 3 × підказки + штраф шлюзів), не менше 0.'],
  ['11. Підказки', '−3 за кожну.'],
];

function EpilogueSteps() {
  return (
    <table className="paper-guide__steps">
      <tbody>
        {STEPS.map(([k, v]) => (
          <tr key={k}>
            <td>
              <strong>{k}</strong>
            </td>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- Правила для гравців ----------

export function RulesSheet() {
  return (
    <article className="guide guide--rules" data-ready="1">
      <p className="guide__case">{paper.caseTitle}</p>
      <h1>{paper.rules.title}</h1>
      <p className="paper-guide__sub">{paper.subtitle}</p>
      <Paras text={paper.rules.intro} />
      {paper.rules.sections.map((s) => (
        <section className="guide__task" key={s.title}>
          <h2>{s.title}</h2>
          <Paras text={s.body} />
        </section>
      ))}
    </article>
  );
}

// ---------- Бланки: звинувачення (гравцям) і протокол партії (ведучому) ----------

export function Forms() {
  return (
    <div className="kit" data-ready="1">
      <section className="sheet paper-form">
        <h1>Бланк звинувачення</h1>
        <p className="paper-form__team">
          Команда: <span className="paper-task__line" />
        </p>
        <p>Одна спроба. Позначте по одному варіанту в кожному питанні й віддайте бланк ведучому.</p>
        {paper.accusation.map((q, i) => (
          <div className="paper-form__q" key={q.id}>
            <h3>
              {i + 1}. {q.prompt}
            </h3>
            <ul>
              {q.options.map((o) => (
                <li key={o.id}>☐ {o.label}</li>
              ))}
            </ul>
          </div>
        ))}
        <footer className="sheet__footer">Справа № 17 · 40 хв · бланк звинувачення</footer>
      </section>

      <section className="sheet paper-form paper-form--protocol">
        <h1>Протокол партії (для ведучого)</h1>
        <p className="paper-form__team">
          Команда: <span className="paper-task__line" />
        </p>
        <p>Рівень: ☐ Стажер ☐ Слідчий · Режим: ☐ Змагання ☐ Відділи · Ведучий видав шлюз сам: ☐ А ☐ Б ☐ В (+5 хв кожен)</p>
        <table className="paper-form__grid">
          <thead>
            <tr>
              <th>Що</th>
              <th>Хвилина / варіант</th>
              <th>Що</th>
              <th>Хвилина / варіант</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Шлюз А (З-1)</td>
              <td />
              <td>Р3 Корж (а/б/в) · Р3+ звільнено?</td>
              <td />
            </tr>
            <tr>
              <td>Шлюз Б (З-3)</td>
              <td />
              <td>Р7 Дорош (а/б/в)</td>
              <td />
            </tr>
            <tr>
              <td>Шлюз В (З-4)</td>
              <td />
              <td>Р5 Луговий (а/б/в/г)</td>
              <td />
            </tr>
            <tr>
              <td>З-5 тінь ☐ · З-6 касова книга ☐</td>
              <td />
              <td>E4 отруєння: хв · З-10 вчасно ☐</td>
              <td />
            </tr>
            <tr>
              <td>З-11 шифр ☐</td>
              <td />
              <td>Р8 Згурська (а/б/в)</td>
              <td />
            </tr>
            <tr>
              <td>Підказки (кількість)</td>
              <td />
              <td>Операція: група 1 · група 2</td>
              <td />
            </tr>
            <tr>
              <td>Штраф шлюзів ведучого, хв</td>
              <td />
              <td>Звинувачення подано, хв</td>
              <td />
            </tr>
          </tbody>
        </table>
        <h3>Розрахунок епілогу</h3>
        <table className="paper-form__epi">
          <tbody>
            {STEPS.map(([k, v]) => (
              <tr key={k}>
                <td>
                  <strong>{k}</strong>
                  <div className="paper-form__rule">{v}</div>
                </td>
                <td className="paper-form__box" />
              </tr>
            ))}
            <tr>
              <td>
                <strong>Разом</strong>
              </td>
              <td className="paper-form__box" />
            </tr>
          </tbody>
        </table>
        <footer className="sheet__footer">Справа № 17 · 40 хв · протокол партії</footer>
      </section>
    </div>
  );
}
