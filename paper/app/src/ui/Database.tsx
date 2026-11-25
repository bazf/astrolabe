import { useState } from 'react';
import { queryKeys } from '../../../shared/answers.ts';
import { hashAnswer } from '../../../shared/seal.ts';
import { Paras } from '../documents/context.tsx';
import { useApp } from './gameContext.tsx';
import { ui } from './strings.ts';

/** База даних поліції (Ц-11): записи знаходяться лише за точним запитом (порівнюються хеші). */
export function Database() {
  const { bundle, t } = useApp();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ title: string; body: string } | null | 'none'>(null);
  return (
    <div className="stack">
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          const keys = queryKeys(query);
          if (!keys.length) return;
          let hit: (typeof bundle.db)[number] | undefined;
          for (const k of keys) {
            const h = await hashAnswer(bundle.dbSalt, k);
            hit = bundle.db.find((x) => x.hashes.includes(h));
            if (hit) break;
          }
          setResult(hit ? { title: t(hit.title), body: t(hit.body) } : 'none');
        }}
      >
        <h1>{ui.dbTitle}</h1>
        <label className="field">
          <span>{ui.dbLabel}</span>
          <input aria-label={ui.dbLabel} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </label>
        <p className="muted">{ui.dbHint}</p>
        <button className="btn btn--primary" type="submit">
          {ui.dbSearch}
        </button>
      </form>
      {result === 'none' && <p className="alert">{ui.dbNothing}</p>}
      {result && result !== 'none' && (
        <section className="card db-record">
          <h2>{result.title}</h2>
          <Paras text={result.body} />
        </section>
      )}
    </div>
  );
}
