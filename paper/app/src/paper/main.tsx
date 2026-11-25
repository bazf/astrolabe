// Сторінки друку паперової партії: ?view=kit|pack|guide|forms|rules&level=trainee|detective
import { createRoot } from 'react-dom/client';
import type { Level } from '../../../shared/case-types.ts';
import { Forms, HostGuide, RulesSheet } from './Guide.tsx';
import { HostPack, PlayerKit } from './Kit.tsx';

const params = new URLSearchParams(window.location.search);
const level: Level = params.get('level') === 'detective' ? 'detective' : 'trainee';
const view = params.get('view') ?? 'kit';
const root = createRoot(document.getElementById('root')!);
const name = level === 'trainee' ? 'Стажер' : 'Слідчий';

if (view === 'guide') {
  document.title = 'Справа № 17 (40 хв) — посібник ведучого';
  root.render(<HostGuide />);
} else if (view === 'rules') {
  document.title = 'Справа № 17 (40 хв) — правила гри';
  root.render(<RulesSheet />);
} else if (view === 'forms') {
  document.title = 'Справа № 17 (40 хв) — бланки';
  root.render(<Forms />);
} else if (view === 'pack') {
  document.title = `Справа № 17 (40 хв) — пачка ведучого «${name}»`;
  root.render(<HostPack level={level} />);
} else {
  document.title = `Справа № 17 (40 хв) — комплект «${name}»`;
  root.render(<PlayerKit level={level} />);
}
