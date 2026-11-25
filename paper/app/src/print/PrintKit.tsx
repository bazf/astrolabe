import type { CaseBundle, Level } from '../../../shared/case-types.ts';
import { DocProvider, useDoc } from '../documents/context.tsx';
import { renderDoc } from '../documents/registry.tsx';
import { ui } from '../ui/strings.ts';
import { planSheets, type SheetPlan } from './layout.ts';
import '../documents/documents.css';
import './print.css';

const ENVELOPES: [string, string, string][] = [
  ['Старт', 'Таємниця слідства · Докази', 'Відкрити одразу'],
  ['А', 'Конверт А · Підміна', 'Відкрийте, коли застосунок скаже'],
  ['Б', 'Конверт Б · Годинник', 'Відкрийте, коли застосунок скаже'],
  ['В', 'Конверт В · Вежа', 'Відкрийте, коли застосунок скаже'],
  ['Г', 'Конверт Г · Вміст сейфа', 'Вкласти в конверт В. Не відкривати без коду'],
];

function EnvelopeLabels() {
  return (
    <div className="envelope-labels">
      {ENVELOPES.map(([id, title, note]) => (
        <div className="envelope-label cut" key={id}>
          <div className="envelope-label__id">{id}</div>
          <div>
            <div className="envelope-label__title">{title}</div>
            <div className="handwritten envelope-label__note">{note}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Sheet({ plan }: { plan: SheetPlan }) {
  const { level } = useDoc();
  const [first, ...rest] = plan.docs;
  // для «Відділів»: ведучий розкладає аркуші по відділах ще до різання
  const depts = [...new Set(plan.docs.map((d) => d.dept).filter((d) => !!d))] as NonNullable<(typeof plan.docs)[number]['dept']>[];
  return (
    <section className={`sheet sheet--${plan.kind}`} data-sheet={plan.number}>
      {plan.kind === 'labels' ? (
        <>
          <div className="sheet__cover cut">{renderDoc(first)}</div>
          <div className="sheet__labels-row">
            <div className="sheet__rules cut">{rest.map((d) => renderDoc(d))}</div>
            <EnvelopeLabels />
          </div>
        </>
      ) : plan.kind === 'cards' ? (
        <div className="sheet__cards">{plan.docs.map((d) => renderDoc(d))}</div>
      ) : (
        plan.docs.map((d) => (
          <div className={`sheet__slot ${plan.kind === 'photos' ? 'cut' : ''}`} key={d.id}>
            {d.dept && (
              <span className={`dept-mark dept-mark--${d.dept}`} title={ui.deptNames[d.dept]}>
                {ui.deptLetters[d.dept]}
              </span>
            )}
            {d.component.match(/Map|Plan|Section/) ? (
              <div className="map-sheet">
                <h2 className="map-sheet__title">
                  {d.label} · <MapTitle docTitle={d.title} />
                </h2>
                {renderDoc(d)}
              </div>
            ) : (
              renderDoc(d)
            )}
          </div>
        ))
      )}
      <footer className="sheet__footer">
        Справа № 17 · аркуш {String(plan.number).padStart(2, '0')} · {level === 'trainee' ? 'Стажер' : 'Слідчий'}
        {depts.length > 0 && ` · ${depts.length > 1 ? 'відділи' : 'відділ'} ${depts.map((d) => ui.deptLetters[d]).join(', ')}`}
      </footer>
    </section>
  );
}

function MapTitle({ docTitle }: { docTitle: string }) {
  const { t } = useDoc();
  return <>{t(docTitle)}</>;
}

export function PrintKit({ bundle, level, baseUrl }: { bundle: CaseBundle; level: Level; baseUrl: string }) {
  const sheets = planSheets(bundle.docs);
  return (
    <DocProvider bundle={bundle} level={level} print baseUrl={baseUrl}>
      <div className="kit">
        {sheets.map((p) => (
          <Sheet key={p.number} plan={p} />
        ))}
      </div>
    </DocProvider>
  );
}
