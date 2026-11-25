import type { CaseBundle } from '../../../shared/case-types.ts';
import { codeLabel, codeUrl, DocProvider, Paras, useDoc } from '../documents/context.tsx';
import { Qr } from '../documents/Qr.tsx';
import './guide.css';

/** Правила гри для друку: без спойлерів, для гравців і організатора. */
export function RulesGuide({ bundle, baseUrl }: { bundle: CaseBundle; baseUrl: string }) {
  return (
    <DocProvider bundle={bundle} level="trainee" print baseUrl={baseUrl}>
      <Rules bundle={bundle} baseUrl={baseUrl} />
    </DocProvider>
  );
}

function Rules({ bundle, baseUrl }: { bundle: CaseBundle; baseUrl: string }) {
  const { t } = useDoc();
  const rules = bundle.rules;
  if (!rules) return <p className="guide-status" data-ready="error">Правил у справі немає.</p>;
  return (
    <article className="guide guide--rules" data-ready="1">
      <header className="guide__cover">
        <p className="guide__case">{t(bundle.title)}</p>
        <h1>{t(rules.title)}</h1>
        <div className="guide__access">
          <div className="guide__intro">
            <Paras text={t(rules.intro)} />
          </div>
          <figure>
            <Qr value={codeUrl(baseUrl, 0)} sizeMm={30} label="Почати гру" />
            <figcaption>
              Почати гру
              <br />
              <strong>{codeLabel(0)}</strong>
            </figcaption>
          </figure>
        </div>
        <p className="guide__url">{baseUrl}</p>
      </header>
      {rules.sections.map((s) => (
        <section className="guide__task" key={s.title}>
          <h2>{t(s.title)}</h2>
          <Paras text={t(s.body)} />
        </section>
      ))}
    </article>
  );
}
