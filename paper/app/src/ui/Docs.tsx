import { useState } from 'react';
import { Paras } from '../documents/context.tsx';
import { renderDoc } from '../documents/registry.tsx';
import type { Dept } from '../../../shared/case-types.ts';
import { DEPTS } from '../engine/departments.ts';
import { visibleDocs } from '../engine/reducer.ts';
import { DeptBadge } from './Dept.tsx';
import { useApp } from './gameContext.tsx';
import { envelopeLabel, ui } from './strings.ts';

export function Archive() {
  const { bundle, game, t } = useApp();
  const departments = game.state!.mode === 'departments';
  const [only, setOnly] = useState<Dept | null>(null);
  // документ без позначки — спільний для всіх відділів
  const docs = visibleDocs(bundle, game.state!).filter((d) => !only || !d.dept || d.dept === only);
  const sections = [...new Set(docs.map((d) => d.section))];
  return (
    <div className="stack">
      <h1>{ui.archive}</h1>
      {departments && (
        <div className="chips">
          {[null, ...DEPTS].map((d) => (
            <button key={d ?? 'all'} className={`chip ${only === d ? 'chip--on' : ''}`} aria-pressed={only === d} onClick={() => setOnly(d)}>
              {d ? ui.deptNames[d] : ui.deptAll}
            </button>
          ))}
        </div>
      )}
      {docs.length === 0 && <p className="muted">{only ? ui.archiveEmptyDept : ui.archiveEmpty}</p>}
      {sections.map((sec) => (
        <section className="card" key={sec}>
          <h2>{ui.sectionNames[sec]}</h2>
          <ul className="list">
            {docs
              .filter((d) => d.section === sec)
              .map((d) => (
                <li key={d.id}>
                  <a className="list__link" href={`#/doc/${d.id}`}>
                    <span>
                      <span className="muted">{d.label}</span> {t(d.title)}
                    </span>
                    {departments && d.dept && <DeptBadge dept={d.dept} />}
                  </a>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function DocScreen({ id }: { id?: string }) {
  const { bundle, game, t } = useApp();
  const [zoom, setZoom] = useState(1);
  const doc = visibleDocs(bundle, game.state!).find((d) => d.id === id);
  if (!doc) return <div className="card">{ui.docUnavailable}</div>;
  return (
    <div className="stack">
      <div className="doc-toolbar">
        <span>
          <span className="muted">{doc.label}</span> {t(doc.title)}
        </span>
        <span>
          <button className="btn btn--small" aria-label={ui.zoomOut} onClick={() => setZoom((z) => Math.max(1, z - 0.25))}>
            −
          </button>
          <button className="btn btn--small" aria-label={ui.zoomIn} onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}>
            +
          </button>
        </span>
      </div>
      <div className="doc-scroll">
        <div style={{ width: `${zoom * 100}%` }}>{renderDoc(doc)}</div>
      </div>
    </div>
  );
}

export function EnvelopeScreen({ id }: { id?: string }) {
  const { game } = useApp();
  const p = id ? game.state!.gatePayloads[id] : undefined;
  if (!p) return <div className="card">{ui.envelopeEarly}</div>;
  return (
    <section className="card envelope">
      <div className="envelope__badge">{envelopeLabel(p.envelope)}</div>
      <Paras text={p.message} />
      <h1>{ui.envelopeOpen(p.envelope)}</h1>
      <a className="btn btn--primary" href="#/case">
        {ui.toCase}
      </a>
    </section>
  );
}
