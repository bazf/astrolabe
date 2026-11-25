import { createRoot } from 'react-dom/client';
import caseJson from '../generated/case.json';
import type { CaseBundle, Level } from '../../../shared/case-types.ts';
import { HostGuide } from './HostGuide.tsx';
import { PrintKit } from './PrintKit.tsx';
import { RulesGuide } from './RulesGuide.tsx';

const params = new URLSearchParams(window.location.search);
const bundle = caseJson as unknown as CaseBundle;
const level: Level = params.get('level') === 'detective' ? 'detective' : 'trainee';
// Адреса розгорнутого застосунку для QR; за замовчуванням — поточний сайт.
const baseUrl = params.get('base') ?? new URL('./', window.location.href).href;
const root = createRoot(document.getElementById('root')!);

if (params.get('guide') === 'rules') {
  // Правила гри без спойлерів — для гравців і організатора.
  document.title = 'Справа № 17 — правила гри';
  root.render(<RulesGuide bundle={bundle} baseUrl={baseUrl} />);
} else if (params.get('guide') === 'host') {
  // Посібник ведучого розшифровується кодом ведучого (той самий, що відкриває пульт).
  document.title = 'Справа № 17 — посібник ведучого';
  root.render(<HostGuide bundle={bundle} code={params.get('code') ?? ''} baseUrl={baseUrl} />);
} else {
  document.title = `Справа № 17 — друк (${level === 'trainee' ? 'Стажер' : 'Слідчий'})`;
  root.render(<PrintKit bundle={bundle} level={level} baseUrl={baseUrl} />);
}
