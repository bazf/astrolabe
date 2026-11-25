import type { GameState } from './state.ts';

/** Усі ігри цього пристрою: на телефоні — одна команда, на мультиборді — кілька. */
export type Board = { games: GameState[]; active: string | null };

export const STORAGE_KEY = 'astrolabe:v2';
/** до етапу 5 пристрій зберігав одну гру */
const LEGACY_KEY = 'astrolabe:v1';

const EMPTY: Board = { games: [], active: null };

function normalize(s: GameState | null | undefined): GameState | null {
  if (!s || s.version !== 1 || typeof s.startedAt !== 'number') return null;
  return { ...s, wrong: s.wrong ?? {}, id: s.id ?? s.startedAt.toString(36), log: s.log ?? [] };
}

/** Повертає false, якщо сховище недоступне (приватний режим, заборона). Гра триває в пам'яті. */
export function saveBoard(b: Board): boolean {
  try {
    if (b.games.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
    else localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadBoard(): Board {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const b = JSON.parse(raw) as Board;
      const games = (Array.isArray(b?.games) ? b.games : []).map(normalize).filter((g): g is GameState => !!g);
      const active = games.some((g) => g.id === b.active) ? b.active : (games[0]?.id ?? null);
      return { games, active };
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    const s = legacy ? normalize(JSON.parse(legacy) as GameState) : null;
    return s ? { games: [s], active: s.id } : EMPTY;
  } catch {
    return EMPTY;
  }
}
