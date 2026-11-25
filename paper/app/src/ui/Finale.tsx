import { useEffect, useState } from 'react';
import { hashAnswer } from '../../../shared/seal.ts';
import { computeEpilogue } from '../engine/epilogue.ts';
import { canAccuse } from '../engine/reducer.ts';
import { useApp } from './gameContext.tsx';
import { navigate } from './router.ts';
import { ui } from './strings.ts';

/** Звинувачення: чотири питання. Правильність перевіряється за хешами — відповідей у збірці немає. */
export function Accuse() {
  const { bundle, game, t } = useApp();
  const s = game.state!;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  useEffect(() => {
    if (s.accusation) navigate('#/epilogue');
  }, [s.accusation]);
  if (s.accusation) return null;
  if (!canAccuse(bundle, s)) return <section className="card">{ui.accuseClosed}</section>;
  const ready = bundle.accusation.every((q) => answers[q.id]);
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready) return;
        const correct: Record<string, boolean> = {};
        for (const q of bundle.accusation) correct[q.id] = (await hashAnswer(q.salt, answers[q.id])) === q.answerHash;
        game.dispatch({ type: 'accuse', answers, correct, now: Date.now() });
        navigate('#/epilogue');
      }}
    >
      <h1>{ui.accuseTitle}</h1>
      <p className="muted">{ui.accuseHint}</p>
      {bundle.accusation.map((q) => (
        <label className="field" key={q.id}>
          <span>{t(q.prompt)}</span>
          <select aria-label={t(q.prompt)} value={answers[q.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}>
            <option value="" disabled>
              {ui.choose}
            </option>
            {q.options.map((o) => (
              <option key={o.id} value={o.id}>
                {t(o.label)}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button className="btn btn--primary" type="submit" disabled={!ready}>
        {ui.accuseSubmit}
      </button>
    </form>
  );
}

export function EpilogueScreen() {
  const { bundle, game, t } = useApp();
  const s = game.state!;
  if (!s.accusation) return <section className="card">{ui.epilogueClosed}</section>;
  const e = computeEpilogue(bundle, s);
  const para = (key: string) => {
    const text = t(`@${key}`);
    return text ? <p key={key}>{text}</p> : null;
  };
  const photo = bundle.docs.find((d) => d.id === '4-11');
  return (
    <div className="stack">
      <article className="doc newspaper">
        <div className="newspaper__mast">{t('@epi.title')}</div>
        <h1 className="newspaper__headline">{t(`@epi.headline.${e.axes.killer}`)}</h1>
        <div className="newspaper__body">
          {e.axes.killer === 'innocent' ? para('epi.innocent') : e.axes.killer !== 'accident' && para(`epi.killer.${e.axes.killer}`)}
          {para(`epi.astrolabe.${e.axes.astrolabe}`)}
          {para(`epi.stepan.${e.axes.stepan}`)}
          {e.axes.korzh !== 'convicted' && para(`epi.korzh.${e.axes.korzh}`)}
          {para(`epi.scheme.${e.axes.scheme}`)}
          {para(`epi.orest.${e.lines.orest}`)}
          {para(`epi.iryna.${e.lines.iryna}`)}
          {para(`epi.solomiya.${e.lines.solomiya}`)}
          {para(`epi.dorosh.${e.lines.dorosh}`)}
          {para(`epi.marta.${e.lines.marta}`)}
        </div>
        {photo && e.lines.orest === 'hero' && <img className="newspaper__photo" src={String(photo.props.src)} alt={t(photo.title)} />}
      </article>

      {e.review.length > 0 && (
        <section className="card">
          <h2>{t('@epi.review.title')}</h2>
          <ul>
            {e.review.map((r) => (
              <li key={r}>{t(`@epi.review.${r}`)}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>{t('@epi.score.title')}</h2>
        <table className="score">
          <tbody>
            {Object.entries(e.score.parts).map(([k, v]) => (
              <tr key={k}>
                <th>{ui.scoreParts[k] ?? k}</th>
                <td>{v > 0 ? `+${v}` : v}</td>
              </tr>
            ))}
            <tr className="score__total">
              <th>{t('@epi.score.total')}</th>
              <td>{e.score.total}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
