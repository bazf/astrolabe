import { createContext, useContext } from 'react';
import type { CaseBundle } from '../../../shared/case-types.ts';
import type { Game } from './useGame.ts';

export type AppCtx = { bundle: CaseBundle; game: Game; t: (ref: unknown) => string };

export const GameCtx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const v = useContext(GameCtx);
  if (!v) throw new Error('useApp поза GameCtx');
  return v;
}

export const fmtClock = (minutes: number) => {
  const total = Math.max(0, Math.floor(minutes * 60));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};
