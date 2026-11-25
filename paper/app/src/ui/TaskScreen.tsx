import { useState } from 'react';
import { SHORT_GAME_KEY } from '../../../shared/seal.ts';
import { checkAnswer } from '../engine/check.ts';
import { decisionsSettledBy, taskVisible } from '../engine/reducer.ts';
import type { GateId } from '../../../shared/case-types.ts';
import { Paras } from '../documents/context.tsx';
import { useApp } from './gameContext.tsx';
import { navigate } from './router.ts';
import { envelopeLabel, ui } from './strings.ts';

export function TaskScreen({ id }: { id?: string }) {
  const { bundle, game, t } = useApp();
  const s = game.state!;
  const task = bundle.tasks.find((x) => x.id === id);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'wrong' | 'unparsable'>('idle');
  const [askHint, setAskHint] = useState(false);
  if (!task) return <div className="card">{ui.unknownCode}</div>;
  if (!taskVisible(bundle, s, task.id)) return <div className="card">{ui.taskNotYet}</div>;

  const used = s.hintsUsed[task.id] ?? 0;
  const solved = s.solved[task.id];
  const hints = task.hints[s.level].slice(0, used);
  const lockedSec = Math.ceil(((s.wrong?.[task.id]?.lockedUntil ?? 0) - game.now) / 1000);

  return (
    <div className="stack">
      <section className="card">
        <div className="muted">{task.label}</div>
        <h1>{t(task.title)}</h1>
        {s.mode === 'departments' && task.depts && <p className="muted">{ui.deptNeeds(task.depts.map((d) => ui.deptNames[d]))}</p>}
        <p>{t(task.question[s.level])}</p>
        {solved ? (
          <div className="banner banner--ok">
            {solved.canon === SHORT_GAME_KEY || s.log.some((e) => e.a.type === 'penalty' && e.a.reason === `gate:${task.gate}`) ? (
              `${ui.solved}: ${ui.solvedByHost}`
            ) : (
              <>
                {ui.solved}: {solved.canon}
                {task.unit ? ` ${task.unit}` : ''}
              </>
            )}
          </div>
        ) : (
          <>
          {task.gate && <GateWarning gate={task.gate} />}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setStatus('checking');
              const res = await checkAnswer(bundle, s, task.id, value);
              if (!res.ok) {
                if (res.canon !== null) game.dispatch({ type: 'wrong', task: task.id, now: Date.now() });
                return setStatus(res.canon === null ? 'unparsable' : 'wrong');
              }
              game.dispatch({ type: 'solved', task: task.id, canon: res.canon!, payload: res.payload, now: Date.now() });
              setStatus('idle');
              if (task.gate) navigate(`#/envelope/${task.gate}`);
            }}
          >
            <label className="field">
              <span>{ui.answerLabel}</span>
              <span className="input-unit">
                <input aria-label={ui.answerLabel} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
                {task.unit && <span className="muted">{task.unit}</span>}
              </span>
            </label>
            {status === 'wrong' && lockedSec <= 0 && <p className="alert">{ui.wrong}</p>}
            {lockedSec > 0 && <p className="alert">{ui.locked(lockedSec)}</p>}
            {status === 'unparsable' && <p className="alert">{ui.unparsable}</p>}
            <button className="btn btn--primary" type="submit" disabled={status === 'checking' || !value.trim() || lockedSec > 0}>
              {status === 'checking' ? ui.checking : ui.check}
            </button>
          </form>
          </>
        )}
        {solved && task.onSolved && (
          <div className="note">
            <Paras text={t(task.onSolved)} />
          </div>
        )}
      </section>

      <section className="card">
        <h2>{ui.hints}</h2>
        <ol className="hints">
          {hints.map((h, i) => (
            <li key={i}>{t(h)}</li>
          ))}
        </ol>
        {!solved &&
          (used >= 3 ? (
            <p className="muted">{ui.noMoreHints}</p>
          ) : askHint ? (
            <div className="confirm">
              <p>{ui.hintConfirm(bundle.hintPenaltyMin)}</p>
              <button
                className="btn btn--primary"
                onClick={() => {
                  game.dispatch({ type: 'hint', task: task.id, now: Date.now() });
                  setAskHint(false);
                }}
              >
                {ui.yes}
              </button>
              <button className="btn" onClick={() => setAskHint(false)}>
                {ui.cancel}
              </button>
            </div>
          ) : (
            <button className="btn" onClick={() => setAskHint(true)}>
              {ui.takeHint(bundle.hintPenaltyMin)}
            </button>
          ))}
      </section>
    </div>
  );
}

/** Перед шлюзом: які рішення слідча ухвалить сама, якщо команда розкриє його зараз. */
function GateWarning({ gate }: { gate: GateId }) {
  const { bundle, game, t } = useApp();
  const due = decisionsSettledBy(bundle, game.state!, gate, game.now);
  if (!due.length) return null;
  return (
    <div className="banner banner--warn gate-warning">
      <strong>{ui.gateWarnTitle}</strong>
      <p>{ui.gateWarn(envelopeLabel(gate))}</p>
      <ul>
        {due.map((id) => (
          <li key={id}>
            <a href={`#/decision/${id}`}>{t(bundle.decisions.find((d) => d.id === id)!.prompt)}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
