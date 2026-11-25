import { Paras } from '../documents/context.tsx';
import { useApp } from './gameContext.tsx';
import { ui } from './strings.ts';

/** «Як грати»: правила без спойлерів. Доступні з першого екрана, ще до початку гри. */
export function RulesScreen() {
  const { bundle, game, t } = useApp();
  const rules = bundle.rules;
  if (!rules) return <section className="card">{ui.unknownCode}</section>;
  return (
    <div className="stack rules">
      <section className="card">
        <h1>{t(rules.title)}</h1>
        <Paras text={t(rules.intro)} />
      </section>
      {rules.sections.map((s) => (
        <section className="card" key={s.title}>
          <h2>{t(s.title)}</h2>
          <Paras text={t(s.body)} />
        </section>
      ))}
      <a className="btn btn--primary" href={game.state ? '#/case' : '#/'}>
        {game.state ? ui.toCase : ui.rulesStart}
      </a>
    </div>
  );
}
