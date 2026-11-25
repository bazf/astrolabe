import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App.tsx';
import caseJson from './generated/case.json';
import type { CaseBundle } from '../../shared/case-types.ts';
import { registerOffline } from './ui/offline.ts';

registerOffline();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App bundle={caseJson as unknown as CaseBundle} />
  </StrictMode>,
);
