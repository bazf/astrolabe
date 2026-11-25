import { useEffect, useState } from 'react';
import type { CaseBundle, Dept, HostData, Level } from '../../../shared/case-types.ts';
import { DocProvider, Paras, useDoc } from '../documents/context.tsx';
import { Qr } from '../documents/Qr.tsx';
import { unlockHost } from '../engine/host.ts';
import { envelopeLabel, ui } from '../ui/strings.ts';
import { deptSheets, envelopeSheets, planSheets, ranges } from './layout.ts';
import './guide.css';

const PLACES: Record<string, [string, string]> = {
  folder: ['Папка', 'на стіл одразу'],
  start: ['Стартовий конверт «Докази»', 'на стіл одразу'],
  A: ['Конверт А', 'видати, коли застосунок скаже'],
  B: ['Конверт Б', 'видати, коли застосунок скаже'],
  C: ['Конверт В', 'видати, коли застосунок скаже'],
  D: ['Конверт Г', 'закрити й вкласти в конверт В'],
};
const LEVELS: [Level, string][] = [
  ['trainee', 'Стажер'],
  ['detective', 'Слідчий'],
];

/** Друкований посібник ведучого: розшифровується тим самим кодом, що й пульт. */
export function HostGuide({ bundle, code, baseUrl }: { bundle: CaseBundle; code: string; baseUrl: string }) {
  const [data, setData] = useState<HostData | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void unlockHost(bundle, code).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [bundle, code]);

  if (data === undefined) return <p className="guide-status">Розшифровую посібник…</p>;
  if (!data)
    return (
      <p className="guide-status" data-ready="error">
        {ui.hostWrong} Посібник не розшифровано.
      </p>
    );
  return (
    <DocProvider bundle={bundle} level="trainee" print baseUrl={baseUrl}>
      <Guide bundle={bundle} data={data} code={code} baseUrl={baseUrl} />
    </DocProvider>
  );
}

function Guide({ bundle, data, code, baseUrl }: { bundle: CaseBundle; data: HostData; code: string; baseUrl: string }) {
  const { t } = useDoc();
  const plans = planSheets(bundle.docs);
  const depts = deptSheets(plans);
  return (
    <article className="guide" data-ready="1">
      <header className="guide__cover">
        <p className="guide__case">Справа № 17. Астролябія</p>
        <h1>Посібник ведучого</h1>
        <p className="guide__warn">Не показуйте гравцям: тут розгадка й усі відповіді.</p>
        <div className="guide__access">
          <div className="guide__code">
            <span>Код ведучого</span>
            <strong>{code}</strong>
            <small>для пульта ведучого в застосунку</small>
          </div>
          <figure>
            <Qr value={baseUrl} sizeMm={30} label="Застосунок гри" />
            <figcaption>Застосунок гри</figcaption>
          </figure>
          <figure>
            <Qr value={`${baseUrl}#/host`} sizeMm={30} label="Пульт ведучого" />
            <figcaption>Пульт ведучого</figcaption>
          </figure>
        </div>
        <p className="guide__url">{baseUrl}</p>
        <Paras text={data.intro} />
      </header>

      <section>
        <h2>Підготовка</h2>
        <Paras text={data.notes.prep} />
        <table>
          <thead>
            <tr>
              <th>Що</th>
              <th>Аркуші</th>
              <th>Коли</th>
            </tr>
          </thead>
          <tbody>
            {envelopeSheets(plans).map((e) => (
              <tr key={e.id}>
                <td>{PLACES[e.id][0]}</td>
                <td>{ranges(e.sheets)}</td>
                <td>{PLACES[e.id][1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Режим «Відділи»: розкладка аркушів</h2>
        <Paras text={data.notes.departments} />
        <div className="guide__depts">
          {(Object.keys(depts) as Dept[]).map((d) => (
            <div key={d}>
              <h3>
                {ui.deptLetters[d]} · {ui.deptNames[d]}
              </h3>
              <ul>
                {depts[d].map(({ sheet, doc }) => (
                  <li key={doc.id}>
                    арк. {sheet} · {doc.label} {t(doc.title)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Брифінг</h2>
        <Paras text={data.notes.briefing} />
      </section>

      <section>
        <h2>Сценарій партії</h2>
        <table>
          <thead>
            <tr>
              <th>{ui.hostWhen}</th>
              <th>{ui.hostStage}</th>
              <th>{ui.hostGive}</th>
            </tr>
          </thead>
          <tbody>
            {data.timeline.map((r) => (
              <tr key={r.when + r.stage}>
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
        <h3>{ui.hostStuck}</h3>
        <Paras text={data.notes.stuck} />
        <h3>{ui.hostShort}</h3>
        <Paras text={data.notes.short} />
      </section>

      <section className="guide__break">
        <h2>Розгадка</h2>
        <Paras text={data.notes.solution} />
        <h3>Правильне звинувачення</h3>
        <table>
          <tbody>
            {data.accusation.map((q) => (
              <tr key={q.prompt}>
                <td>{q.prompt}</td>
                <td>
                  <strong>{q.answer}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Відповіді на завдання</h2>
        <table>
          <thead>
            <tr>
              <th>Завдання</th>
              {LEVELS.map(([l, name]) => (
                <th key={l}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <strong>{task.label}</strong> {task.title}
                  {task.gate && <div className="guide__muted">{ui.hostGate(envelopeLabel(task.gate))}</div>}
                  {task.optional && <div className="guide__muted">{ui.optional}</div>}
                </td>
                {LEVELS.map(([l]) => (
                  <td key={l}>{task.levels[l].answer}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Розв'язки</h2>
        {data.tasks.map((task) => (
          <div className="guide__task" key={task.id}>
            <h3>
              {task.label}. {task.title}
            </h3>
            {LEVELS.map(([l, name]) => (
              <div key={l}>
                <p className="guide__muted">
                  <strong>{name}:</strong> {task.levels[l].question}
                </p>
                <Paras text={task.levels[l].solution} />
              </div>
            ))}
          </div>
        ))}
      </section>

      <section>
        <h2>Рішення та наслідки</h2>
        {data.decisions.map((d) => (
          <div className="guide__task" key={d.id}>
            <h3>
              {d.label}. {d.prompt}
            </h3>
            {d.deadline && <p className="guide__muted">{ui.hostDeadline(envelopeLabel(d.deadline))}</p>}
            <ul>
              {d.options.map((o) => (
                <li key={o.id}>
                  <strong>{o.label}</strong>
                  {o.id === d.defaultOption && <span className="guide__muted"> · {ui.hostDefault}</span>}
                  {o.after.map((a, i) => (
                    <div key={i} className="guide__muted">
                      {a.split('\n\n')[0]}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h2>Рахунок</h2>
        <Paras text={data.notes.scoring} />
      </section>
    </article>
  );
}
