// Документи, яких немає в застосунку: обкладинка, аркуш слідчого, витяг з бази — лише для паперу.
import type { ReactNode } from 'react';
import { Paras, useDoc } from '../documents/context.tsx';
import { paper, type Task } from './data.ts';

type P = Record<string, unknown>;

export function PaperCover() {
  const { level } = useDoc();
  return (
    <div className="doc cover">
      <div className="stamp stamp--round">Рівень: {level === 'trainee' ? 'Стажер' : 'Слідчий'}</div>
      <div className="cover__kicker">Старокамінський районний відділ поліції</div>
      <h1 className="cover__title">{paper.caseTitle}</h1>
      <div className="cover__line">Справа № 17 · Том № 1</div>
      <div className="handwritten cover__note">Розслідування відкрито</div>
      <div className="stamp stamp--rect">Таємниця слідства</div>
      <div className="paper-cover__time">40 хвилин</div>
    </div>
  );
}

export function TaskBlock({ task, children }: { task: Task; children?: ReactNode }) {
  const { level } = useDoc();
  return (
    <section className="task-sheet__task paper-task">
      <h3>
        {task.label}. {task.title}
        {task.gate && <span className="paper-task__gate"> · відкриває конверт</span>}
        {task.branch && <span className="paper-task__gate"> · термінове</span>}
      </h3>
      <p>{task.question[level]}</p>
      <div className="paper-task__answer">
        <span>Відповідь{task.unit ? ` (${task.unit})` : ''}:</span>
        <span className="paper-task__line" />
      </div>
      <div className="task-sheet__notes">Розрахунки:</div>
      {children}
    </section>
  );
}

export function PaperTaskSheet({ number, tasks, intro, data, table }: P) {
  const { level } = useDoc();
  const list = (tasks as string[]).map((id) => paper.tasks.find((t) => t.id === id)!);
  return (
    <div className="doc task-sheet paper-task-sheet">
      <div className="task-sheet__head">
        <h2>{number ? `Аркуш слідчого № ${String(number)}` : 'Термінове завдання'}</h2>
        <span className="stamp stamp--rect">{level === 'trainee' ? 'Стажер' : 'Слідчий'}</span>
      </div>
      {!!intro && <p>{String(intro)}</p>}
      {list.map((t) => (
        <TaskBlock key={t.id} task={t} />
      ))}
      {!!data && (
        <section className="note-box">
          <h4>Довідка</h4>
          <Paras text={String(data)} />
        </section>
      )}
      {!!table && <DataTable table={table as { title: string; columns: string[]; rows: string[][] }} />}
    </div>
  );
}

function DataTable({ table }: { table: { title: string; columns: string[]; rows: string[][] } }) {
  const COLS = 4;
  const per = Math.ceil(table.rows.length / COLS);
  const chunks = Array.from({ length: COLS }, (_, i) => table.rows.slice(i * per, (i + 1) * per));
  return (
    <section className="data-table">
      <h4>{table.title}</h4>
      <div className="data-table__cols">
        {chunks.map((rows, i) => (
          <table key={i}>
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]}>
                  {r.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </section>
  );
}

/** Ц-11: у застосунку — пошук у базі; на папері — витяг з усіх записів. */
export function DbExtract() {
  return (
    <div className="doc db-extract">
      <div className="muted">Національна поліція · база даних · витяг за запитом слідчої групи · 13.09.2026</div>
      <h3>Ц-11. Витяг з бази даних поліції</h3>
      <div className="db-extract__grid">
        {paper.db.map((e) => (
          <div className="db-extract__entry" key={e.title}>
            <strong>{e.title}</strong>
            <Paras text={e.body} />
          </div>
        ))}
      </div>
    </div>
  );
}
