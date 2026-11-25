import QRCode from 'qrcode';
import { r3 } from '../maps/scale.ts';

/** QR як SVG-прямокутники (синхронно, без canvas — працює і в друці, і в SSR-тестах). */
export function Qr({ value, sizeMm, label }: { value: string; sizeMm: number; label?: string }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const quiet = 2;
  const cell = sizeMm / (n + quiet * 2);
  const rects: string[] = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.modules.get(row, col)) rects.push(`M${r3((col + quiet) * cell)} ${r3((row + quiet) * cell)}h${r3(cell)}v${r3(cell)}h${-r3(cell)}z`);
    }
  }
  return (
    <svg className="qr" data-qr={value} viewBox={`0 0 ${sizeMm} ${sizeMm}`} width={`${sizeMm}mm`} height={`${sizeMm}mm`} role="img" aria-label={label ?? value}>
      <rect width={sizeMm} height={sizeMm} fill="#fff" />
      <path d={rects.join('')} fill="#000" shapeRendering="crispEdges" />
    </svg>
  );
}
