import { useEffect, useState } from 'react';
import type { HostData, Level } from '../../../shared/case-types.ts';
import { Paras } from '../documents/context.tsx';
import { computeEpilogue } from '../engine/epilogue.ts';
import { nextGate, openGateFor, unlockHost } from '../engine/host.ts';
import { elapsedMin, GATE_ORDER } from '../engine/reducer.ts';
import type { GameState } from '../engine/state.ts';
import { fmtClock, useApp } from './gameContext.tsx';
import { envelopeLabel, ui } from './strings.ts';

/**
 * Розшифрований пульт живе лише в пам'яті вкладки і лише поки відкрито цей екран: вихід з пульта,
 * оновлення сторінки чи кнопка «Закрити пульт» його закривають (на спільному екрані гравці не мають
 * побачити розгадку). На диск код не пишемо.
 */
let unlocked: HostData | null = null;

/** Пульт ведучого: усе, що тут показано, розшифровується кодом ведучого. */
export function HostScreen() {
  const { bundle } = useApp();
  const [data, setData] = useState<HostData | null>(unlocked);
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const lock = () => {
    unlocked = null;
    setData(null);
    setCode('');
  };
  useEffect(
    () => () => {
      unlocked = null;
    },
    [],
  );

  if (!data) {
    return (
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          const d = await unlockHost(bundle, code);
          setWrong(!d);
          if (!d) return;
          unlocked = d;
          setData(d);
        }}
      >
        <h1>{ui.hostLockedTitle}</h1>
        <p className="muted">{ui.hostLockedHint}</p>
        <label className="field">
          <span>{ui.hostCode}</span>
          <input aria-label={ui.hostCode} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
        </label>
        {wrong && <p className="alert">{ui.hostWrong}</p>}
        <button className="btn btn--primary" type="submit">
          {ui.hostOpen}
        </button>
      </form>
    );
  }
  return <HostConsole data={data} onLock={lock} />;
}

function HostConsole({ data, onLock }: { data: HostData; onLock: () => void }) {
  const { game } = useApp();
  const [level, setLevel] = useState<Level>(game.state?.level ?? 'trainee');
  return (
    <div className="stack host">
      <section className="card">
        <h1>{ui.hostTitle}</h1>
        <Paras text={data.intro} />
        <button className="btn" onClick={onLock}>
          {ui.hostLock}
        </button>
      </section>

      <section className="card">
        <h2>{ui.hostTeams}</h2>
        {game.games.length === 0 ? <p className="muted">{ui.hostNoTeams}</p> : <TeamsTable data={data} />}
      </section>

      <details className="card" open>
        <summary>
          <h2>{ui.hostTimeline}</h2>
        </summary>
        <div className="table-wrap">
          <table className="host-table">
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
                    <div className="muted">{r.what}</div>
                  </td>
                  <td>{r.give}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>{ui.hostStuck}</h3>
        <Paras text={data.notes.stuck} />
        <h3>{ui.hostShort}</h3>
        <Paras text={data.notes.short} />
        <h3>{ui.hostDepartments}</h3>
        <Paras text={data.notes.departments} />
      </details>

      <details className="card">
        <summary>
          <h2>{ui.hostSolutionTitle}</h2>
        </summary>
        <Paras text={data.notes.solution} />
        <h3>{ui.hostAccusation}</h3>
        <div className="table-wrap">
          <table className="host-table">
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
        </div>
        <h3>{ui.hostScoring}</h3>
        <Paras text={data.notes.scoring} />
      </details>

      <details className="card">
        <summary>
          <h2>{ui.hostAnswers}</h2>
        </summary>
        <div className="chips">
          {(['trainee', 'detective'] as Level[]).map((l) => (
            <button key={l} className={`chip ${level === l ? 'chip--on' : ''}`} aria-pressed={level === l} onClick={() => setLevel(l)}>
              {l === 'trainee' ? ui.levelTrainee : ui.levelDetective}
            </button>
          ))}
        </div>
        <ul className="host-list">
          {data.tasks.map((task) => (
            <li key={task.id}>
              <div>
                <strong>{task.label}</strong> {task.title}
                {task.gate && <span className="pill">{ui.hostGate(envelopeLabel(task.gate))}</span>}
                {task.optional && <span className="muted"> ({ui.optional})</span>}
              </div>
              <div className="host-answer">{task.levels[level].answer}</div>
              <details>
                <summary>{ui.hostSolution}</summary>
                <p className="muted">{task.levels[level].question}</p>
                <Paras text={task.levels[level].solution} />
              </details>
            </li>
          ))}
        </ul>
      </details>

      <details className="card">
        <summary>
          <h2>{ui.hostDecisions}</h2>
        </summary>
        <ul className="host-list">
          {data.decisions.map((d) => (
            <li key={d.id}>
              <div>
                <strong>{d.label}</strong> {d.prompt}
                {d.deadline && <span className="muted"> · {ui.hostDeadline(envelopeLabel(d.deadline))}</span>}
              </div>
              <ul>
                {d.options.map((o) => (
                  <li key={o.id}>
                    <strong>{o.label}</strong>
                    {o.id === d.defaultOption && <span className="muted"> · {ui.hostDefault}</span>}
                    {o.after.map((a, i) => (
                      <div key={i} className="muted">
                        {a.split('\n\n')[0]}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function TeamsTable({ data }: { data: HostData }) {
  const { bundle, game } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const open = async (g: GameState) => {
    setBusy(g.id);
    const n = await openGateFor(bundle, g, data, Date.now());
    if (n) game.put(n, false);
    setBusy(null);
  };
  return (
    <div className="table-wrap">
      <table className="host-table">
        <thead>
          <tr>
            <th>{ui.teamPicker}</th>
            <th>{ui.timer}</th>
            <th>{ui.hostGates}</th>
            <th>{ui.hostHints}</th>
            <th>{ui.hostResult}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {game.games.map((g) => {
            const gate = g.accusation ? null : nextGate(bundle, g);
            const hints = Object.values(g.hintsUsed).reduce((a, b) => a + b, 0);
            return (
              <tr key={g.id}>
                <td>{g.team}</td>
                <td>
                  {fmtClock(elapsedMin(g, game.now))}
                  <div className="muted small">
                    {g.level === 'trainee' ? ui.levelTrainee : ui.levelDetective}
                    {g.short ? ' · 60' : ''}
                  </div>
                </td>
                <td>
                  {GATE_ORDER.map((x) => (
                    <span key={x} className={`gate-dot ${g.gatePayloads[x] ? 'gate-dot--on' : ''}`}>
                      {envelopeLabel(x)}
                    </span>
                  ))}
                </td>
                <td>{hints}</td>
                <td>{g.accusation ? computeEpilogue(bundle, g).score.total : g.pendingDecisions.length > 0 ? ui.hostWaiting(g.pendingDecisions.length) : '—'}</td>
                <td>
                  {gate && (
                    <button className="btn" disabled={busy === g.id} onClick={() => void open(g)}>
                      {ui.hostOpenGate(envelopeLabel(gate), bundle.host?.gatePenaltyMin ?? 0)}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
