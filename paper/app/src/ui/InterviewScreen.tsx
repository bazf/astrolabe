import { useEffect, useState } from 'react';
import { interviewStatus } from '../engine/reducer.ts';
import { renderDoc } from '../documents/registry.tsx';
import { useApp } from './gameContext.tsx';
import { navigate } from './router.ts';
import { ui } from './strings.ts';

export function InterviewScreen({ id }: { id?: string }) {
  const { bundle, game, t } = useApp();
  const s = game.state!;
  const iv = bundle.interviews.find((x) => x.id === id);
  const status = iv ? interviewStatus(bundle, s, iv.id) : null;
  const [confirm, setConfirm] = useState(false);

  // Допит до рішення Р1: запускаємо подію, що його вимагає, і ведемо до рішення.
  useEffect(() => {
    if (!iv || status !== 'needsDecision') return;
    if (s.pendingDecisions.length) navigate(`#/decision/${s.pendingDecisions[0]}`);
    else game.dispatch({ type: 'interview', id: iv.id, now: Date.now() });
  }, [iv, status, s.pendingDecisions, game]);

  if (!iv) return <div className="card">{ui.unknownCode}</div>;
  if (status === 'needsDecision') return <div className="card">{t('@int.needsE1')}</div>;
  if (status === 'closed') return <div className="card">{t('@int.closed')}</div>;
  if (status === 'quotaUsed') return <div className="card">{t('@int.quotaUsed')}</div>;

  const doc = bundle.docs.find((d) => d.id === iv.doc);
  if (status === 'done' && doc) return <div className="stack">{renderDoc(doc)}</div>;

  const left = s.interviewQuota - s.interviewsDone.length - 1;
  return (
    <section className="card">
      <h1>{t(iv.who)}</h1>
      {confirm ? (
        <div className="confirm">
          <p>{ui.interviewConfirm(left)}</p>
          <button className="btn btn--primary" onClick={() => game.dispatch({ type: 'interview', id: iv.id, now: Date.now() })}>
            {ui.yes}
          </button>
          <button className="btn" onClick={() => setConfirm(false)}>
            {ui.cancel}
          </button>
        </div>
      ) : (
        <button className="btn btn--primary" onClick={() => setConfirm(true)}>
          {ui.interviewStart}
        </button>
      )}
    </section>
  );
}
