// Карти й креслення. Усі розміри — у міліметрах паперу, тож лінійка на роздруківці
// вимірює саме ті відстані, на яких побудовані завдання.
import { useDoc } from '../documents/context.tsx';
import { frameSize, mmPerMeter, project, r3, type Frame } from './scale.ts';

const INK = '#2b2620';
const svgSize = (print: boolean, w: number, h: number) =>
  print ? { width: `${w}mm`, height: `${h}mm` } : { width: '100%', style: { maxWidth: `${w * 4}px`, height: 'auto' } };

function ScaleBar({ x, y, k, meters, step, label }: { x: number; y: number; k: number; meters: number; step: number; label: (m: number) => string }) {
  const parts = Math.round(meters / step);
  return (
    <g>
      <rect data-scalebar={meters} x={x} y={y} width={r3(meters * k)} height={1.6} fill="none" stroke={INK} strokeWidth={0.25} />
      {Array.from({ length: parts }, (_, i) => (i % 2 === 0 ? <rect key={i} x={r3(x + i * step * k)} y={y} width={r3(step * k)} height={1.6} fill={INK} /> : null))}
      {Array.from({ length: parts + 1 }, (_, i) => (
        <text key={i} x={r3(x + i * step * k)} y={y + 4.4} fontSize={2.4} textAnchor="middle" fill={INK}>
          {label(i * step)}
        </text>
      ))}
    </g>
  );
}

function NorthArrow({ x, y }: { x: number; y: number }) {
  return (
    <g data-compass transform={`translate(${x} ${y})`}>
      <circle r={6} fill="none" stroke={INK} strokeWidth={0.25} />
      <path d="M0 -5.5 L2 1.5 L0 0.3 L-2 1.5 Z" fill={INK} />
      <path d="M0 5.5 L2 -1.5 L0 -0.3 L-2 -1.5 Z" fill="none" stroke={INK} strokeWidth={0.25} />
      <text y={-7.2} fontSize={3} textAnchor="middle" fontWeight="bold" fill={INK}>Пн</text>
      <text x={8.4} y={1} fontSize={2.4} textAnchor="middle" fill={INK}>Сх</text>
      <text y={10} fontSize={2.4} textAnchor="middle" fill={INK}>Пд</text>
      <text x={-8.6} y={1} fontSize={2.4} textAnchor="middle" fill={INK}>Зх</text>
    </g>
  );
}

const pathOf = (f: Frame, pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${project(f, x, y).x} ${project(f, x, y).y}`).join(' ');

export function TownMap() {
  const { bundle, t, print } = useDoc();
  const g = bundle.geometry.town;
  const f: Frame = { ...g.bounds, margin: 8, k: mmPerMeter(g.scale) };
  const { w, h } = frameSize(f);
  const gateN = g.routes.viaPark.points[2];
  const gateS = g.routes.viaPark.points[5];
  const pN = project(f, gateN[0], gateN[1]);
  const pS = project(f, gateS[0], gateS[1]);
  const fills: Record<string, string> = { park: '#d5e6c6', pond: '#bcd6ea', rynok: '#eadfca', zamkova: '#eadfca' };
  const stationFrom = project(f, g.bounds.maxX - 40, g.bounds.maxY - 140);
  const [dx, dy] = g.station.dir;
  const len = Math.hypot(dx, dy);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} {...svgSize(print, w, h)} className="map" fontFamily="'PT Sans Narrow', 'Arial Narrow', sans-serif">
      <rect x={0} y={0} width={w} height={h} fill="#f7f2e7" />
      {Object.entries(g.areas).map(([id, a]) => (
        <g key={id}>
          <path d={`${pathOf(f, a.points)} Z`} fill={fills[id] ?? '#e8e0d0'} stroke="#b9ad96" strokeWidth={0.2} />
        </g>
      ))}
      {g.streets.map((s, i) => (
        <path key={`o${i}`} d={pathOf(f, s.points)} fill="none" stroke="#bdb3a1" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {g.streets.map((s, i) => (
        <path key={`i${i}`} d={pathOf(f, s.points)} fill="none" stroke="#fffdf8" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      <path d={pathOf(f, g.routes.viaPark.points.slice(2, 6))} fill="none" stroke="#8a6d45" strokeWidth={0.5} strokeDasharray="1.2 0.8" />
      {g.streets.map((s, i) => {
        if (!s.name) return null;
        const [a, b] = [s.points[0], s.points[1]];
        const pa = project(f, a[0], a[1]);
        const pb = project(f, b[0], b[1]);
        let ang = (Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180) / Math.PI;
        if (ang > 90) ang -= 180;
        if (ang < -90) ang += 180;
        const mx = r3((pa.x + pb.x) / 2);
        const my = r3((pa.y + pb.y) / 2);
        return (
          <text key={`n${i}`} x={mx} y={my} fontSize={1.9} fill="#6d6253" textAnchor="middle" dominantBaseline="central" transform={`rotate(${r3(ang)} ${mx} ${my})`}>
            {t(s.name)}
          </text>
        );
      })}
      {Object.entries(g.areas).map(([id, a]) => {
        // Підпис площі — у нижньому лівому куті, щоб не перекривати точки всередині.
        const minX = Math.min(...a.points.map((q) => q[0]));
        const minY = Math.min(...a.points.map((q) => q[1]));
        const big = id === 'park' || id === 'pond';
        const cx = a.points.reduce((s, q) => s + q[0], 0) / a.points.length;
        const cy = a.points.reduce((s, q) => s + q[1], 0) / a.points.length;
        const p = big ? project(f, cx, cy) : project(f, minX, minY);
        return (
          <text key={`l${id}`} x={big ? p.x : p.x + 0.8} y={big ? p.y : p.y - 1} fontSize={2.6} fill="#5c6b4a" textAnchor={big ? 'middle' : 'start'} fontStyle="italic">
            {t(a.label)}
          </text>
        );
      })}
      <g>
        <rect x={pN.x - 1.1} y={pN.y - 0.6} width={2.2} height={1.2} fill={INK} />
        <rect x={pS.x - 1.1} y={pS.y - 0.6} width={2.2} height={1.2} fill={INK} />
        <text x={pN.x + 2} y={pN.y - 1.2} fontSize={2.1} fill={INK}>Ворота парку · {g.parkHours}</text>
        <text x={pS.x + 2} y={pS.y + 2.4} fontSize={2.1} fill={INK}>Ворота парку · {g.parkHours}</text>
      </g>
      {Object.entries(g.points).map(([id, pt]) => {
        const p = project(f, pt.x, pt.y);
        const main = id === 'tower';
        return (
          <g key={id}>
            <circle data-point={id} cx={p.x} cy={p.y} r={main ? 1.4 : 0.9} fill={main ? '#8c1c13' : INK} />
            <text
              x={id === 'crowd' ? p.x - 1.8 : p.x + 1.8}
              y={id === 'crowd' ? p.y - 1.2 : p.y + 0.9}
              textAnchor={id === 'crowd' ? 'end' : 'start'}
              fontSize={main ? 2.6 : 2.3}
              fontWeight={main ? 'bold' : 'normal'}
              fill={INK}
            >
              {t(pt.label)}
            </text>
          </g>
        );
      })}
      <g>
        <line x1={stationFrom.x} y1={stationFrom.y} x2={r3(stationFrom.x + (dx / len) * 12)} y2={r3(stationFrom.y - (dy / len) * 12)} stroke={INK} strokeWidth={0.5} markerEnd="url(#arrow)" />
        <text x={stationFrom.x - 2} y={stationFrom.y + 4} fontSize={2.3} fill={INK} textAnchor="end">{t(g.station.label)}</text>
      </g>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill={INK} />
        </marker>
      </defs>
      <text x={2.2} y={r3(h / 2)} fontSize={2.4} fill={INK} transform={`rotate(-90 2.2 ${r3(h / 2)})`} textAnchor="middle">
        {g.latitude}
      </text>
      <NorthArrow x={w - 12} y={14} />
      <ScaleBar x={10} y={h - 9} k={f.k} meters={500} step={100} label={(m) => (m === 500 ? '500 м' : String(m))} />
      <text x={w - 4} y={h - 3} fontSize={2.4} textAnchor="end" fill={INK}>Масштаб 1 : {g.scale.toLocaleString('uk-UA')}</text>
    </svg>
  );
}

export function SquarePlan() {
  const { bundle, t, print } = useDoc();
  const g = bundle.geometry.square;
  const f: Frame = { minX: -75, maxX: 70, minY: -80, maxY: 70, margin: 8, k: mmPerMeter(g.scale) };
  const { w, h } = frameSize(f);
  const P = (x: number, y: number) => project(f, x, y);
  const rect = (x0: number, y0: number, x1: number, y1: number) => {
    const a = P(x0, y1);
    const b = P(x1, y0);
    return { x: a.x, y: a.y, width: r3(b.x - a.x), height: r3(b.y - a.y) };
  };
  const pt = g.points;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} {...svgSize(print, w, h)} className="map" fontFamily="'PT Sans Narrow', 'Arial Narrow', sans-serif">
      <rect x={0} y={0} width={w} height={h} fill="#f7f2e7" />
      <rect {...rect(-70, -46, 65, 65)} fill="#ece2cf" stroke="#b9ad96" strokeWidth={0.2} />
      <rect {...rect(-60, -78, -18, -46)} fill="#d9cdb6" stroke={INK} strokeWidth={0.35} />
      <text {...P(-39, -63)} fontSize={3} textAnchor="middle" fill={INK}>Музей (колишній магістрат)</text>
      <rect {...rect(-4, 0, 4, 8)} fill="#c9b9a0" stroke={INK} strokeWidth={0.4} />
      <rect {...rect(30, 40, 47, 58)} fill="#ddd2bd" stroke={INK} strokeWidth={0.3} />
      <circle cx={P(pt.well.x, pt.well.y).x} cy={P(pt.well.x, pt.well.y).y} r={1.6} fill="none" stroke={INK} strokeWidth={0.3} />
      <circle cx={P(pt.sundial.x, pt.sundial.y).x} cy={P(pt.sundial.x, pt.sundial.y).y} r={2.2} fill="none" stroke={INK} strokeWidth={0.3} />
      {Object.entries(pt).map(([id, p]) => {
        const q = P(p.x, p.y);
        return (
          <g key={id}>
            <circle data-point={id} cx={q.x} cy={q.y} r={0.7} fill={id === 'tower' ? '#8c1c13' : INK} />
            <text x={q.x + 2.6} y={q.y - 1.6} fontSize={2.8} fill={INK}>{t(p.label)}</text>
          </g>
        );
      })}
      <text {...P(-2, -12)} fontSize={2.4} fill={INK} textAnchor="middle">Південна площа −1,60</text>
      <text {...P(0, 7)} fontSize={2.4} fill={INK} textAnchor="middle">поріг вежі ±0,00</text>
      <NorthArrow x={w - 14} y={16} />
      <ScaleBar x={10} y={h - 9} k={f.k} meters={50} step={10} label={(m) => (m === 50 ? '50 м' : String(m))} />
      <text x={w - 4} y={h - 3} fontSize={2.4} textAnchor="end" fill={INK}>Масштаб 1 : {g.scale.toLocaleString('uk-UA')}</text>
    </svg>
  );
}

/** Розріз вежі, 1:250. Не для вимірювань — лише відмітки рівнів. */
export function TowerSection({ note }: { note?: string }) {
  const { t, print } = useDoc();
  // 1:350 — уся вежа з відміткою південної площі (−1,60) вміщується в половину аркуша А4
  const k = mmPerMeter(350);
  const w = 84;
  const top = 33;
  const bottom = -2.5;
  const h = r3((top - bottom) * k + 12);
  const Y = (m: number) => r3((top - m) * k + 6);
  const X0 = 14;
  const X1 = X0 + 8 * k;
  const levels: [number, string][] = [
    [0, '±0,00 поріг входу'],
    [-1.6, '−1,60 південна площа'],
    [12.6, '+12,60 годинникова кімната'],
    [14.5, '+14,50 центр циферблатів'],
    [18.0, '+18,00 підлога галереї'],
    [19.1, '+19,10 поручень'],
    [31.0, '+31,00 шпиль'],
  ];
  return (
    <figure className="doc-figure">
      <svg viewBox={`0 0 ${w} ${h}`} {...svgSize(print, w, h)} fontFamily="'PT Sans Narrow', 'Arial Narrow', sans-serif">
        <rect x={0} y={0} width={w} height={h} fill="#f4f6f8" />
        <path d={`M${X0} ${Y(0)} L${X0} ${Y(21)} L${(X0 + X1) / 2} ${Y(31)} L${X1} ${Y(21)} L${X1} ${Y(0)} Z`} fill="#dfe5ea" stroke="#23324a" strokeWidth={0.35} />
        <rect x={X0 - 1.6} y={Y(18.0)} width={X1 - X0 + 3.2} height={0.5} fill="#23324a" />
        <line x1={X0 - 1.6} y1={Y(19.1)} x2={X0 - 1.6} y2={Y(18)} stroke="#23324a" strokeWidth={0.3} />
        <line x1={X1 + 1.6} y1={Y(19.1)} x2={X1 + 1.6} y2={Y(18)} stroke="#23324a" strokeWidth={0.3} />
        <circle cx={(X0 + X1) / 2} cy={Y(14.5)} r={1.6} fill="none" stroke="#23324a" strokeWidth={0.3} />
        <rect x={X0 + 0.6} y={Y(16.2)} width={X1 - X0 - 1.2} height={r3(3.6 * k)} fill="none" stroke="#23324a" strokeWidth={0.2} strokeDasharray="0.8 0.5" />
        <line x1={2} y1={Y(-1.6)} x2={X0} y2={Y(-1.6)} stroke="#23324a" strokeWidth={0.3} />
        <line x1={X1} y1={Y(0)} x2={w - 2} y2={Y(0)} stroke="#23324a" strokeWidth={0.3} />
        <text x={3} y={Y(-1.6) + 3} fontSize={1.8} fill="#23324a">Пд</text>
        <text x={w - 6} y={Y(0) + 3} fontSize={1.8} fill="#23324a">Пн</text>
        {levels.map(([m, label]) => (
          <g key={label}>
            <line x1={X1 + 2.4} y1={Y(m)} x2={X1 + 5} y2={Y(m)} stroke="#23324a" strokeWidth={0.2} />
            <text x={X1 + 5.6} y={Y(m) + 0.7} fontSize={2} fill="#23324a">{label}</text>
          </g>
        ))}
      </svg>
      {note && <figcaption>{t(note)}</figcaption>}
    </figure>
  );
}
