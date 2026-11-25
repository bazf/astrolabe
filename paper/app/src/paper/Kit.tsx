// Комплект гравців (папка + конверти) і пачка ведучого (картки + документи за рішеннями).
import type { CaseDoc, Dept, Level } from '../../../shared/case-types.ts';
import { DocProvider, Paras, useDoc } from '../documents/context.tsx';
import { renderDoc } from '../documents/registry.tsx';
import { DbExtract, PaperCover, PaperTaskSheet } from './docs.tsx';
import { bundle, DEPT_LETTERS, DEPT_NAMES, docLabel, paper, type Decision } from './data.ts';
import '../documents/documents.css';
import '../print/print.css';
import './paper.css';

const OWN: Record<string, (p: Record<string, unknown>) => React.ReactNode> = {
  PaperCover: () => <PaperCover />,
  PaperTaskSheet: (p) => <PaperTaskSheet {...p} />,
  DbExtract: () => <DbExtract />,
};

function Doc({ doc }: { doc: CaseDoc }) {
  const { level } = useDoc();
  const own = OWN[doc.component];
  if (own) return <>{own({ ...doc.props, ...(doc.levels?.[level] ?? {}) })}</>;
  return renderDoc(doc);
}

type Kind = 'full' | 'photos' | 'cards' | 'halves';
const kindOf = (docs: CaseDoc[]): Kind =>
  docs.length === 1 ? 'full' : docs.every((d) => d.component === 'PhotoPrint') ? 'photos' : docs.some((d) => d.component === 'DossierCards') ? 'cards' : 'halves';

export function KitSheet({ number, docs, where }: { number: number | string; docs: CaseDoc[]; where: string }) {
  const { level } = useDoc();
  const kind = kindOf(docs);
  const depts = [...new Set(docs.map((d) => d.dept).filter(Boolean))] as Dept[];
  return (
    <section className={`sheet sheet--${kind} paper-sheet`} data-sheet={number}>
      {kind === 'cards' ? (
        <div className="sheet__cards">
          {docs.map((d) => (
            <Doc key={d.id} doc={d} />
          ))}
        </div>
      ) : (
        docs.map((d) => (
          <div className={`sheet__slot ${kind === 'photos' ? 'cut' : ''}`} key={d.id}>
            {d.dept && (
              <span className={`dept-mark dept-mark--${d.dept}`} title={DEPT_NAMES[d.dept]}>
                {DEPT_LETTERS[d.dept]}
              </span>
            )}
            {d.component.match(/Map|Plan|Section/) ? (
              <div className="map-sheet">
                <h2 className="map-sheet__title">
                  {d.label} · {d.title}
                </h2>
                <Doc doc={d} />
              </div>
            ) : (
              <Doc doc={d} />
            )}
          </div>
        ))
      )}
      <footer className="sheet__footer">
        Справа № 17 · 40 хв · {where} · аркуш {String(number).padStart(2, '0')} · {level === 'trainee' ? 'Стажер' : 'Слідчий'}
        {depts.length > 0 && ` · ${depts.length > 1 ? 'відділи' : 'відділ'} ${depts.map((d) => DEPT_LETTERS[d]).join(', ')}`}
      </footer>
    </section>
  );
}

export function PlayerKit({ level }: { level: Level }) {
  return (
    <DocProvider bundle={bundle} level={level} print>
      <div className="kit" data-ready="1">
        {paper.envelopes.map((e) =>
          e.sheets.map((s) => <KitSheet key={s.number} number={s.number} docs={s.docs} where={e.id === 'folder' ? 'папка' : `конверт ${e.label}`} />),
        )}
      </div>
    </DocProvider>
  );
}

// ---------- Картки ----------

type CardDef = { kind: string; tag: string; title: string; body?: string; list?: string[]; foot?: string; big?: boolean };

/** Літера варіанта за порядком: а, б, в, г. */
export const optLetter = (d: Decision, id: string) => 'абвг'[d.options.findIndex((o) => o.id === id)] ?? '•';

function decisionCard(d: Decision): CardDef {
  return {
    kind: 'decision',
    tag: `Рішення ${d.label}`,
    title: d.prompt,
    body: d.context,
    list: d.options.map((o) => `${optLetter(d, o.id)}) ${o.label}`),
    foot: d.deadline ? `Дедлайн: ${d.deadline}. Скажіть ведучому літеру варіанта.` : 'Скажіть ведучому, коли вирішите.',
  };
}

export function cardsFor(level: Level): { section: string; cards: CardDef[] }[] {
  const gates = Object.entries(paper.gates).map(([g, v]) => ({ kind: 'gate', tag: `Шлюз ${g === 'C' ? 'В' : g === 'B' ? 'Б' : 'А'}`, title: 'Правильно!', body: v.text }));
  const events = paper.events.map((e) => ({ kind: 'event', tag: `Подія ${e.id}`, title: e.id.startsWith('E4') ? 'Терміново' : e.id === 'E5' ? 'Фінал' : 'Дзвінок / новини', body: e.text }));
  const decisions = paper.decisions.map(decisionCard);
  const outcomes = paper.decisions.flatMap((d) =>
    d.options
      .filter((o) => o.after)
      .map((o) => ({
        kind: 'outcome',
        tag: `${d.label} · ${optLetter(d, o.id)}`,
        title: o.label,
        body: o.after,
        foot: o.give?.length ? `Ведучий видає: ${o.give.map(docLabel).join(', ')}` : undefined,
      })),
  );
  const solved = paper.tasks
    .filter((t) => t.onSolved)
    .map((t) => ({ kind: 'gate', tag: `${t.label} · розв'язано`, title: t.title, body: t.onSolved }));
  const hints = paper.tasks.flatMap((t) =>
    t.hints[level].map((h, i) => ({ kind: 'hint', tag: `${t.label} · підказка ${i + 1} з 3`, title: t.title, body: h, foot: `−3 бали, +${paper.hintPenaltyMin} хв` })),
  );
  const labels = paper.envelopes
    .filter((e) => e.id !== 'folder')
    .map((e) => ({ kind: 'label', tag: 'Наклейка на конверт', title: e.label, body: e.title, foot: e.note, big: true }));
  return [
    { section: 'Наклейки на конверти', cards: labels },
    { section: 'Шлюзи й розв’язки', cards: [...gates, ...solved] },
    { section: 'Події', cards: events },
    { section: 'Рішення', cards: decisions },
    { section: 'Наслідки рішень', cards: outcomes },
    { section: 'Підказки', cards: hints },
  ];
}

function Card({ c }: { c: CardDef }) {
  return (
    <div className={`pcard pcard--${c.kind}`}>
      <div className="pcard__tag">{c.tag}</div>
      <div className={`pcard__title ${c.big ? 'pcard__title--big' : ''}`}>{c.title}</div>
      {c.body && (
        <div className="pcard__body">
          <Paras text={c.body} />
        </div>
      )}
      {c.list && (
        <ul className="pcard__list">
          {c.list.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      {c.foot && <div className="pcard__foot">{c.foot}</div>}
    </div>
  );
}

const PER_PAGE = 6;

export function HostPack({ level }: { level: Level }) {
  const groups = cardsFor(level);
  const pages: { section: string; cards: CardDef[] }[] = [];
  // картки йдуть суцільно (без порожніх місць між розділами); вид картки видно за кольором і написом угорі
  const all = groups.flatMap((g) => g.cards.map((c) => ({ c, section: g.section })));
  for (let i = 0; i < all.length; i += PER_PAGE) {
    const chunk = all.slice(i, i + PER_PAGE);
    pages.push({ section: [...new Set(chunk.map((x) => x.section))].join(', '), cards: chunk.map((x) => x.c) });
  }
  const z10 = paper.tasks.find((t) => t.branch)!;
  const z10Sheet: CaseDoc = {
    id: 'T-Z10',
    label: 'Аркуш',
    title: 'Термінове завдання',
    medium: 'paper',
    section: 'C',
    component: 'PaperTaskSheet',
    props: { tasks: [z10.id], intro: 'Луговий у реанімації. Токсиколог чекає дозу — у вас п’ять хвилин. Дані — у документі Ц-15.' },
    dept: 'K',
  };
  const outcome = [...paper.outcomeDocs];
  const sheets: CaseDoc[][] = [];
  // гілкові документи — по два на аркуш (Ц-15 разом з аркушем З-10)
  const c15 = outcome.find((d) => d.id === 'C15')!;
  const rest = outcome.filter((d) => d !== c15);
  for (let i = 0; i < rest.length; i += 2) sheets.push(rest.slice(i, i + 2));
  sheets.push([c15, z10Sheet]);
  return (
    <DocProvider bundle={bundle} level={level} print>
      <div className="kit" data-ready="1">
        {pages.map((p, i) => (
          <section className="sheet paper-cards" data-sheet={`К${i + 1}`} key={i}>
            <div className="paper-cards__grid">
              {p.cards.map((c, j) => (
                <Card key={j} c={c} />
              ))}
            </div>
            <footer className="sheet__footer">
              Справа № 17 · 40 хв · пачка ведучого · {p.section} · картки {i + 1} · {level === 'trainee' ? 'Стажер' : 'Слідчий'}
            </footer>
          </section>
        ))}
        {sheets.map((docs, i) => (
          <KitSheet key={`o${i}`} number={`Д${i + 1}`} docs={docs} where="пачка ведучого (за рішеннями)" />
        ))}
      </div>
    </DocProvider>
  );
}
