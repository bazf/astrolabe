// Компоненти документів справи. Один компонент — і для екрана застосунку, і для друку.
import { useState } from 'react';
import { Paras, codeLabel, codeUrl, useDoc } from './context.tsx';
import { Qr } from './Qr.tsx';
import { r3 } from '../maps/scale.ts';

type P = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : '');

function Photo({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const { print } = useDoc();
  const [broken, setBroken] = useState(false);
  return broken ? (
    <div className={`photo-missing ${className ?? ''}`}>{alt}</div>
  ) : (
    <img className={className} src={src} alt={alt} loading={print ? 'eager' : 'lazy'} onError={() => setBroken(true)} />
  );
}

function CodeTag({ code, caption }: { code: number; caption?: string }) {
  const { baseUrl } = useDoc();
  return (
    <div className="code-tag">
      <Qr value={codeUrl(baseUrl, code)} sizeMm={16} label={codeLabel(code)} />
      <div>
        {caption && <div className="code-tag__caption">{caption}</div>}
        <div className="code-tag__code">{codeLabel(code)}</div>
      </div>
    </div>
  );
}

export function Cover({ code }: P) {
  const { level, t } = useDoc();
  return (
    <div className="doc cover">
      <div className="stamp stamp--round">Рівень: {level === 'trainee' ? 'Стажер' : 'Слідчий'}</div>
      <div className="cover__kicker">Старокамінський районний відділ поліції</div>
      <h1 className="cover__title">{t('@case.title')}</h1>
      <div className="cover__line">Справа № 17 · Том № 1</div>
      <div className="handwritten cover__note">Розслідування відкрито</div>
      <div className="stamp stamp--rect">Таємниця слідства</div>
      <CodeTag code={Number(code)} caption="Почати гру" />
    </div>
  );
}

export function RulesCard({ body }: P) {
  const { t } = useDoc();
  return (
    <div className="doc rules">
      <Paras text={t(body)} />
    </div>
  );
}

export function BriefingLetter({ body, victim }: P) {
  const { t } = useDoc();
  const v = (victim ?? {}) as P;
  return (
    <div className="doc letter">
      <div className="letterhead">
        <strong>Національна поліція України</strong>
        <span>Слідче управління ГУНП в Хмельницькій області</span>
      </div>
      <Paras text={t(body)} />
      <section className="victim">
        <Photo src={s(v.photo)} alt={t(v.name)} className="victim__photo" />
        <div>
          <h3>{t(v.name)}</h3>
          <div className="muted">
            {t(v.born)} · {t(v.role)}
          </div>
          <Paras text={t(v.bio)} />
        </div>
      </section>
    </div>
  );
}

export function CipherDisk({ alphabet }: P) {
  const letters = [...s(alphabet)];
  const ring = (d: number, inner: boolean) => {
    const r = d / 2;
    const n = letters.length;
    return (
      <svg viewBox={`${-r - 1} ${-r - 1} ${d + 2} ${d + 2}`} width={`${d + 2}mm`} height={`${d + 2}mm`} className="cipher-ring">
        <circle r={r} fill="#fffdf6" stroke="#222" strokeWidth={0.3} />
        <circle r={1.2} fill="none" stroke="#222" strokeWidth={0.3} />
        {letters.map((ch, i) => {
          const a = (i / n) * 2 * Math.PI - Math.PI / 2;
          const a2 = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2;
          const rt = r - (inner ? 6 : 6);
          return (
            <g key={ch}>
              <line x1={r3(Math.cos(a2) * (r - 11))} y1={r3(Math.sin(a2) * (r - 11))} x2={r3(Math.cos(a2) * r)} y2={r3(Math.sin(a2) * r)} stroke="#999" strokeWidth={0.15} />
              <text x={r3(Math.cos(a) * rt)} y={r3(Math.sin(a) * rt)} fontSize={inner ? 4.2 : 4.6} textAnchor="middle" dominantBaseline="central" transform={`rotate(${r3((a * 180) / Math.PI + 90)} ${r3(Math.cos(a) * rt)} ${r3(Math.sin(a) * rt)})`} fontFamily="'Courier Prime', monospace" fontWeight="bold">
                {ch}
              </text>
              <text x={r3(Math.cos(a) * (rt - 6))} y={r3(Math.sin(a) * (rt - 6))} fontSize={1.8} textAnchor="middle" dominantBaseline="central" fill="#777">
                {i}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };
  return (
    <div className="doc cipher">
      <p className="muted">Виріжте обидва диски, покладіть менший на більший і скріпіть кнопкою або скріпкою по центру. Поверніть внутрішній диск на потрібний зсув.</p>
      <div className="cipher__rings">
        {ring(140, false)}
        {ring(104, true)}
      </div>
    </div>
  );
}

export function Protocol({ header, body, signature }: P) {
  const { t } = useDoc();
  return (
    <div className="doc typed protocol">
      <div className="typed__header">
        <Paras text={t(header)} />
      </div>
      <Paras text={t(body)} />
      <div className="signature">{t(signature)}</div>
      <div className="stamp stamp--round stamp--faint">Патрульна поліція · Старокамінь</div>
    </div>
  );
}

export function ClockHands({ time }: { time: string }) {
  const [h, m] = time.split(':').map(Number);
  const am = (m / 60) * 360;
  const ah = ((h % 12) / 12) * 360 + (m / 60) * 30;
  return (
    <svg className="clock-hands" viewBox="-50 -50 100 100" aria-hidden>
      <line x1={0} y1={6} x2={0} y2={-26} stroke="#111" strokeWidth={4} strokeLinecap="round" transform={`rotate(${ah})`} />
      <line x1={0} y1={8} x2={0} y2={-40} stroke="#111" strokeWidth={2.6} strokeLinecap="round" transform={`rotate(${am})`} />
      <circle r={3} fill="#111" />
    </svg>
  );
}

export function PhotoPrint({ src, src2, caption, exif, overlay, overlayPos, note, code, codeCaption }: P) {
  const { t } = useDoc();
  const pos = (overlayPos ?? { left: '50%', top: '50%', size: '40%' }) as { left: string; top: string; size: string };
  const ex = (Array.isArray(exif) ? exif : []).map((e) => t(e));
  return (
    <figure className="doc photo-print">
      <div className={`photo-print__frames ${src2 ? 'photo-print__frames--two' : ''}`}>
        <div className="photo-print__frame">
          <Photo src={s(src)} alt={t(caption)} />
          {overlay === 'clockStopped' && (
            <div className="overlay" style={{ left: pos.left, top: pos.top, width: pos.size, height: pos.size }}>
              <ClockHands time="22:10" />
            </div>
          )}
          {ex[0] && <div className="exif">{ex[0]}</div>}
        </div>
        {!!src2 && (
          <div className="photo-print__frame">
            <Photo src={s(src2)} alt={t(caption)} />
            {ex[1] && <div className="exif">{ex[1]}</div>}
          </div>
        )}
      </div>
      <figcaption className="handwritten-label">{t(caption)}</figcaption>
      {!!note && <div className="photo-print__note">{t(note)}</div>}
      {!!code && <CodeTag code={Number(code)} caption={t(codeCaption)} />}
    </figure>
  );
}

export function ExpertReport({ header, body, signature, extra }: P) {
  const { t } = useDoc();
  return (
    <div className="doc typed expert">
      <div className="typed__header">
        <Paras text={t(header)} />
      </div>
      <Paras text={t(body)} />
      {!!extra && (
        <div className="note-box">
          <Paras text={t(extra)} />
        </div>
      )}
      <div className="signature">{t(signature)}</div>
    </div>
  );
}

export function SpeedTable({ rows, note }: P) {
  const { t } = useDoc();
  return (
    <div className="doc speed-table">
      <h4>Швидкість відриву і обставини падіння</h4>
      <table>
        <tbody>
          {(rows as string[]).map((r) => (
            <tr key={r}>
              <td>{t(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">{t(note)}</p>
    </div>
  );
}

export function SpecSheet({ body }: P) {
  const { t } = useDoc();
  return (
    <div className="doc spec">
      <div className="spec__logo">БАЙДА-БУД</div>
      <Paras text={t(body)} />
    </div>
  );
}

export function Clipping({ paper, date, headline, body, code, codeCaption }: P) {
  const { t } = useDoc();
  return (
    <article className="doc clipping">
      <div className="clipping__mast">
        {t(paper)} · {t(date)}
      </div>
      <h2>{t(headline)}</h2>
      <div className="clipping__body">
        <Paras text={t(body)} />
      </div>
      {!!code && <CodeTag code={Number(code)} caption={t(codeCaption)} />}
    </article>
  );
}

export function PhotoReport({ intro, items }: P) {
  const { t } = useDoc();
  return (
    <div className="doc report">
      <p className="muted">{t(intro)}</p>
      <ol className="report__list">
        {(items as { time: string; source: string; text: string }[]).map((it) => (
          <li key={it.time + it.source}>
            <span className="time-badge">{it.time}</span>
            <div>
              <div className="report__source">{t(it.source)}</div>
              <div>{t(it.text)}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function DossierCards({ cards }: P) {
  const { t } = useDoc();
  return (
    <div className="dossier-cards">
      {(cards as P[]).map((c) => (
        <div className="doc dossier" key={s(c.name)}>
          <div className="dossier__head">
            <Photo src={s(c.photo)} alt={t(c.name)} className="dossier__photo" />
            <div>
              <div className="dossier__kicker">Картка фігуранта</div>
              <h3>{t(c.name)}</h3>
              <div className="muted">{t(c.born)} р. н.</div>
            </div>
          </div>
          <dl>
            <dt>Посада</dt>
            <dd>{t(c.role)}</dd>
            <dt>Адреса</dt>
            <dd>{t(c.address)}</dd>
            <dt>Авто</dt>
            <dd>{t(c.car)}</dd>
            <dt>Примітки</dt>
            <dd>{t(c.notes)}</dd>
          </dl>
          {c.code !== undefined && <CodeTag code={Number(c.code)} caption={c.codeCaption ? t(c.codeCaption) : 'Допитати'} />}
        </div>
      ))}
    </div>
  );
}

export function TaskSheet({ number, tasks, codes, intro, data, table }: P) {
  const { bundle, level, t } = useDoc();
  const list = (tasks as string[]).map((id) => bundle.tasks.find((x) => x.id === id)!).filter(Boolean);
  return (
    <div className="doc task-sheet">
      <div className="task-sheet__head">
        <h2>Аркуш слідчого № {String(number)}</h2>
        <span className="stamp stamp--rect">{level === 'trainee' ? 'Стажер' : 'Слідчий'}</span>
      </div>
      <p>{t(intro)}</p>
      {list.map((task, i) => (
        <section className="task-sheet__task" key={task.id}>
          <h3>
            {task.label}. {t(task.title)} {task.optional && <span className="muted">(за бажанням)</span>}
          </h3>
          <p>{t(task.question[level])}</p>
          <CodeTag code={(codes as number[])[i]} caption="Ввести відповідь" />
          <div className="task-sheet__notes">Нотатки:</div>
        </section>
      ))}
      <section className="note-box">
        <h4>Довідка</h4>
        <Paras text={t(data)} />
      </section>
      {!!table && <DataTable table={table as { title: string; columns: string[]; rows: string[][] }} />}
    </div>
  );
}

/** Довідкова таблиця на аркуші завдань (напр., таблиця Сонця), у кілька колонок. */
function DataTable({ table }: { table: { title: string; columns: string[]; rows: string[][] } }) {
  const { t } = useDoc();
  const COLS = 4;
  const per = Math.ceil(table.rows.length / COLS);
  const chunks = Array.from({ length: COLS }, (_, i) => table.rows.slice(i * per, (i + 1) * per));
  return (
    <section className="data-table">
      <h4>{t(table.title)}</h4>
      <div className="data-table__cols">
        {chunks.map((rows, i) => (
          <table key={i}>
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c}>{t(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]}>
                  {r.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </section>
  );
}

export function Transcript({ body }: P) {
  const { t } = useDoc();
  return (
    <div className="doc transcript">
      <Paras text={t(body)} />
    </div>
  );
}

/** Фото криміналістів: текстура бруківки + сітка плитки 40×40, маркер «1» на лінії карниза, крейдяна позначка. */
export function ForensicPhoto({ src, tiles, oblique, caption }: P) {
  const { t } = useDoc();
  const n = Number(tiles);
  const cols = n + 3;
  const rows = 6;
  const cell = 10;
  const W = cols * cell;
  const H = rows * cell;
  return (
    <figure className="doc forensic">
      <div className={`forensic__frame ${oblique ? 'forensic__frame--oblique' : ''}`}>
        <Photo src={s(src)} alt={t(caption)} />
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="forensic__grid">
          {Array.from({ length: cols + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i * cell} y1={0} x2={i * cell} y2={H} stroke="rgba(40,36,30,.55)" strokeWidth={0.5} />
          ))}
          {Array.from({ length: rows + 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * cell} x2={W} y2={i * cell} stroke="rgba(40,36,30,.55)" strokeWidth={0.5} />
          ))}
          <line x1={cell} y1={0} x2={cell} y2={H} stroke="rgba(255,255,255,.5)" strokeWidth={0.6} strokeDasharray="2 1.5" />
          <g transform={`translate(${cell - 3.5} ${H / 2 - 9})`}>
            <path d="M0 7 L3.5 0 L7 7 Z" fill="#f2c200" stroke="#333" strokeWidth={0.3} />
            <text x={3.5} y={6.1} fontSize={4} textAnchor="middle" fontWeight="bold">1</text>
          </g>
          <path
            d={`M${cell + n * cell - 3.4} ${H / 2 - 7} q 4 -2 3.4 3 q -1.2 5 2 8 q -4 3 -5.6 -1 q -2.4 -6 0.2 -10 z`}
            fill="none"
            stroke="rgba(255,255,255,.92)"
            strokeWidth={0.9}
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <figcaption>{t(caption)}</figcaption>
    </figure>
  );
}

export function InterviewRecord({ interview }: P) {
  const { bundle, t } = useDoc();
  const iv = bundle.interviews.find((x) => x.id === interview);
  if (!iv) return <div className="doc">—</div>;
  return (
    <div className="doc transcript interview">
      <div className="muted">Протокол допиту свідка · {t(iv.who)}</div>
      {iv.lines.map((l, i) => (
        <p key={i}>
          <strong>{t(l.who)}:</strong> {t(l.text)}
        </p>
      ))}
    </div>
  );
}

// ---------- Акт 2 ----------

/** Інвентарна картка музею. Третя цифра року схована під кавовою плямою. */
export function InventoryCard({ number, name, yearStained, rows, checks, photo }: P) {
  const { t } = useDoc();
  const year = s(yearStained);
  const [before, after] = year.split('_');
  return (
    <div className="doc inventory">
      <div className="inventory__head">
        <span className="inventory__kicker">Інвентарна картка</span>
        <span className="inventory__number">{s(number)}</span>
      </div>
      <div className="inventory__body">
        <div>
          <h3>{t(name)}</h3>
          <div className="inventory__year">
            Рік: {before}
            <span className="coffee-stain" aria-hidden />
            {after}
          </div>
          <table className="inventory__table">
            <tbody>
              {(rows as [string, string][]).map(([k, v]) => (
                <tr key={k}>
                  <th>{t(k)}</th>
                  <td>{t(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!!photo && <Photo src={s(photo)} alt={t(name)} className="inventory__photo" />}
      </div>
      <div className="handwritten inventory__checks">{t(checks)}</div>
    </div>
  );
}

export function OfficialAct({ header, body, signature, stamp }: P) {
  const { t } = useDoc();
  return (
    <div className="doc typed official">
      <div className="typed__header">
        <Paras text={t(header)} />
      </div>
      <Paras text={t(body)} />
      <div className="signature">{t(signature)}</div>
      {!!stamp && <div className="stamp stamp--round stamp--faint">{t(stamp)}</div>}
    </div>
  );
}

/** Процедурний відбиток пальця: еліптичні хвилясті лінії (без жодних реальних даних). */
function Fingerprint({ seed }: { seed: number }) {
  const lines = Array.from({ length: 11 }, (_, i) => {
    const rx = 4 + i * 2.1;
    const ry = 6 + i * 2.6;
    const wob = ((seed * (i + 3)) % 7) / 10;
    return <ellipse key={i} cx={22 + wob} cy={28 - wob} rx={rx} ry={ry} fill="none" stroke="#222" strokeWidth={0.9} strokeDasharray={`${8 + ((seed + i) % 5)} ${1 + (i % 3)}`} />;
  });
  return (
    <svg viewBox="0 0 44 56" className="fingerprint" aria-hidden>
      <clipPath id={`fp${seed}`}>
        <ellipse cx={22} cy={28} rx={19} ry={25} />
      </clipPath>
      <g clipPath={`url(#fp${seed})`}>{lines}</g>
    </svg>
  );
}

export function FingerprintReport({ header, body, signature, code, codeCaption }: P) {
  const { t } = useDoc();
  return (
    <div className="doc typed official">
      <div className="typed__header">
        <Paras text={t(header)} />
      </div>
      <div className="fingerprints">
        {[3, 5, 8, 11].map((n) => (
          <Fingerprint key={n} seed={n} />
        ))}
      </div>
      <Paras text={t(body)} />
      <div className="signature">{t(signature)}</div>
      {!!code && <CodeTag code={Number(code)} caption={t(codeCaption)} />}
    </div>
  );
}

export function LogTable({ intro, columns, rows, note, signature }: P) {
  const { t } = useDoc();
  return (
    <div className="doc log">
      <p className="muted">{t(intro)}</p>
      <div className="log__scroll">
        <table>
          <thead>
            <tr>
              {(columns as string[]).map((c) => (
                <th key={c}>{t(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rows as string[][]).map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j}>{t(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!!note && <div className="note-box">{t(note)}</div>}
      {!!signature && <div className="signature">{t(signature)}</div>}
    </div>
  );
}

export function Letter({ from, to, body, signature }: P) {
  const { t } = useDoc();
  return (
    <div className="doc letter-plain">
      <div className="letter-plain__meta">
        <div>
          <span className="muted">Від:</span> {t(from)}
        </div>
        <div>
          <span className="muted">Кому:</span> {t(to)}
        </div>
      </div>
      <Paras text={t(body)} />
      <div className="signature">{t(signature)}</div>
    </div>
  );
}

// ---------- Акт 4 ----------

/** Чернетка акта: справжня маса закреслена, зверху вписана «потрібна». */
export function DraftAct({ header, body, struck, over, note }: P) {
  const { t } = useDoc();
  const [before, after] = t(body).split('{MASS}');
  return (
    <div className="doc typed draft">
      <div className="typed__header">
        <Paras text={t(header)} />
      </div>
      <Paras text={before ?? ''} />
      <p className="draft__mass">
        <s className="draft__struck">{s(struck)}</s> <span className="handwritten draft__over">{s(over)}</span> г
      </p>
      {after && <Paras text={after} />}
      {!!note && <div className="note-box">{t(note)}</div>}
    </div>
  );
}

/** Сторінка записника: шифровка рукою Ореста і нотатки на полях. */
export function NotebookPage({ heading, cipher, margin, marginExtra, code, codeCaption }: P) {
  const { t } = useDoc();
  return (
    <div className="doc notebook">
      <div className="notebook__margin handwritten">
        <div>{t(margin)}</div>
        {!!marginExtra && <div>{t(marginExtra)}</div>}
      </div>
      <h3 className="handwritten notebook__heading">{t(heading)}</h3>
      <p className="notebook__cipher">{s(cipher)}</p>
      {!!code && <CodeTag code={Number(code)} caption={t(codeCaption)} />}
    </div>
  );
}
