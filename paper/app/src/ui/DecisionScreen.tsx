import { useState } from 'react';
import type { Dept } from '../../../shared/case-types.ts';
import { Paras } from '../documents/context.tsx';
import { DEPTS, tallyVotes } from '../engine/departments.ts';
import { availableDecisions, optionMessage, optionsFor } from '../engine/reducer.ts';
import { useApp } from './gameContext.tsx';
import { ui } from './strings.ts';

export function DecisionScreen({ id }: { id?: string }) {
  const { bundle, game, t } = useApp();
  const s = game.state!;
  const d = bundle.decisions.find((x) => x.id === id);
  const [choice, setChoice] = useState<string | null>(null);
  const [votes, setVotes] = useState<Partial<Record<Dept, string>>>({});
  const [lead, setLead] = useState('');
  if (!d) return <div className="card">{ui.unknownCode}</div>;

  const trigger = bundle.events.find((e) => e.decision === d.id && s.firedEvents.includes(e.id));
  const situation = trigger?.message ?? d.context;
  const decided = s.decisions[d.id];
  const afterText = (optId: string) => {
    const m = optionMessage(bundle, s, d.id, optId);
    return m ? t(m) : '';
  };

  if (decided) {
    return (
      <section className="card">
        <h1>{ui.decided}</h1>
        <p>
          <strong>{t(d.options.find((o) => o.id === decided)?.label)}</strong>
        </p>
        <Paras text={afterText(decided)} />
        <a className="btn btn--primary" href="#/case">
          {ui.toCase}
        </a>
      </section>
    );
  }
  const open = s.pendingDecisions.includes(d.id) || availableDecisions(bundle, s).includes(d.id);
  if (!open) return <section className="card">{ui.notYet}</section>;
  const allowed = optionsFor(bundle, s, d.id);
  const options = d.options.filter((o) => allowed.includes(o.id));
  const departments = s.mode === 'departments';
  const tally = tallyVotes(votes, lead || undefined);
  const winner = departments ? tally.winner : choice;
  const labelOf = (id: string) => t(d.options.find((o) => o.id === id)?.label);

  return (
    <section className="card">
      {situation && (
        <div className="note">
          <Paras text={t(situation)} />
        </div>
      )}
      <h1>{t(d.prompt)}</h1>
      {departments ? (
        <div className="votes">
          <p className="muted">{ui.voteHint}</p>
          {DEPTS.map((dep) => (
            <label className="field" key={dep}>
              <span>{ui.deptNames[dep]}</span>
              <select aria-label={ui.vote(ui.deptNames[dep])} value={votes[dep] ?? ''} onChange={(e) => setVotes({ ...votes, [dep]: e.target.value || undefined })}>
                <option value="">{ui.choose}</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {t(o.label)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {tally.tie && (
            <>
              <p>{ui.voteTie}</p>
              <label className="field">
                <span>{ui.voteLead}</span>
                <select aria-label={ui.voteLead} value={lead} onChange={(e) => setLead(e.target.value)}>
                  <option value="">{ui.choose}</option>
                  {options
                    .filter((o) => Object.values(votes).includes(o.id))
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {t(o.label)}
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}
          {winner && (
            <p>
              <strong>{ui.voteResult(labelOf(winner))}</strong>
            </p>
          )}
        </div>
      ) : (
        <div className="options">
          {options.map((o) => (
            <button key={o.id} className={`btn option ${choice === o.id ? 'option--selected' : ''}`} onClick={() => setChoice(o.id)}>
              {t(o.label)}
            </button>
          ))}
        </div>
      )}
      {winner && (
        <div className="confirm">
          <p>{ui.decideConfirm}</p>
          <button className="btn btn--primary" onClick={() => game.dispatch({ type: 'decide', decision: d.id, option: winner, now: Date.now() })}>
            {ui.confirm}
          </button>
        </div>
      )}
    </section>
  );
}
