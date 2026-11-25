import { availableDecisions, canAccuse, elapsedMin, GATE_ORDER, interviewStatus, isOptional, visibleTasks } from '../engine/reducer.ts';
import { useState } from 'react';
import { codeLabel, Paras } from '../documents/context.tsx';
import { useApp } from './gameContext.tsx';
import { ui } from './strings.ts';

export function Dashboard() {
  const { bundle, game, t } = useApp();
  const s = game.state!;
  const inbox = [...s.inbox].reverse();
  const [expanded, setExpanded] = useState<string[]>([]);
  const notDone = bundle.interviews.filter((i) => ['available', 'needsDecision'].includes(interviewStatus(bundle, s, i.id))).length;
  const interviewsLeft = s.flags.case_closed ? 0 : Math.min(notDone, Math.max(0, s.interviewQuota - s.interviewsDone.length));
  const interviewCodes = bundle.codes.filter((c) => 'interview' in c.action).map((c) => codeLabel(c.code));
  return (
    <div className="stack">
      {!!s.flags.case_closed && <div className="banner banner--warn">{ui.caseClosed}</div>}
      {s.accusation ? (
        <a className="banner banner--ok" href="#/epilogue">
          {ui.epilogueBanner}
        </a>
      ) : (
        canAccuse(bundle, s) && (
          <a className="banner banner--action" href="#/accuse">
            {ui.accuseBanner}
          </a>
        )
      )}
      {/* рішення, що чекають, і термінові завдання — у смузі уваги над кожним екраном (Attention.tsx) */}
      {availableDecisions(bundle, s)
        .filter((d) => !s.pendingDecisions.includes(d))
        .map((d) => {
        const dec = bundle.decisions.find((x) => x.id === d)!;
        return (
          <a key={d} className="banner" href={`#/decision/${d}`}>
            {t(dec.prompt)}
          </a>
        );
      })}
      {/* лише найновіший конверт: старі банери плутали команди, чи вони вже відкриті */}
      {GATE_ORDER.filter((g) => s.gatePayloads[g])
        .slice(-1)
        .map((g) => (
          <a key={g} className="banner banner--ok" href={`#/envelope/${g}`}>
            {ui.envelopeOpen(g)}
          </a>
        ))}
      {interviewsLeft > 0 && (
        <div className="banner">
          {ui.interviewsLeft(s.interviewsDone.length, s.interviewQuota, interviewCodes)}
        </div>
      )}

      <section className="card">
        <h2>{ui.tasks}</h2>
        <ul className="list">
          {visibleTasks(bundle, s).map((task) => (
            <li key={task.id}>
              <a href={`#/task/${task.id}`} className="list__link">
                <span>
                  {task.label}. {t(task.title)} {isOptional(bundle, s, task.id) && <span className="muted">({ui.optional})</span>}
                </span>
                {s.solved[task.id] ? <span className="pill pill--ok">{ui.solved}</span> : (s.hintsUsed[task.id] ?? 0) > 0 && <span className="pill">{s.hintsUsed[task.id]}/3</span>}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>{ui.inbox}</h2>
        {inbox.length === 0 && <p className="muted">{ui.noMessages}</p>}
        <ul className="inbox">
          {inbox.map((m) => {
            const text = m.text ?? t(m.messageId);
            const [first, ...more] = text.split('\n\n');
            const open = expanded.includes(m.id);
            return (
              <li
                key={m.id}
                className={m.read ? '' : 'inbox__unread'}
                onClick={() => {
                  if (!m.read) game.dispatch({ type: 'read', inboxId: m.id });
                  if (more.length) setExpanded((x) => (x.includes(m.id) ? x.filter((y) => y !== m.id) : [...x, m.id]));
                }}
              >
                {/* хвилина гри, а не годинник на стіні: час у тексті — сюжетний */}
                <time>{ui.gameMinute(Math.floor((m.at - s.startedAt) / 60_000))}</time>
                <div className="inbox__text">{open ? <Paras text={text} /> : <>{first}{more.length > 0 && <span className="muted"> {ui.readMore}</span>}</>}</div>
              </li>
            );
          })}
        </ul>
      </section>

      <a className="btn" href="#/team">
        {ui.teamLink}
      </a>
      <a className="btn" href="#/rules">
        {ui.rulesLink}
      </a>

      <p className="muted small">
        {ui.levelLabel}: {s.level === 'trainee' ? ui.levelTrainee : ui.levelDetective} · {s.team} · {ui.penalty}: {s.penaltyMin} хв · {ui.elapsed}: {Math.floor(elapsedMin(s, game.now))} хв
      </p>
    </div>
  );
}
