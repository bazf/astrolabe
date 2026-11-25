import { useCallback, useEffect, useState } from 'react';
import type { CaseBundle } from '../../../shared/case-types.ts';
import { reduce } from '../engine/reducer.ts';
import type { Action, GameState } from '../engine/state.ts';
import { loadBoard, saveBoard, STORAGE_KEY, type Board } from '../engine/storage.ts';

export type Game = {
  /** активна команда */
  state: GameState | null;
  /** усі команди цього пристрою (мультиборд) */
  games: GameState[];
  /** `start` додає команду, `reset` прибирає активну, решта діє на активну */
  dispatch: (a: Action) => void;
  switchTo: (id: string) => void;
  /** додає гру або замінює гру з тим самим id; за замовчуванням робить її активною (приєднання, злиття) */
  put: (s: GameState, activate?: boolean) => void;
  now: number;
  storageOk: boolean;
};

const newId = (now: number) => `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function boardFor(bundle: CaseBundle): Board {
  const b = loadBoard();
  const games = b.games.filter((g) => g.caseId === bundle.id);
  return { games, active: games.some((g) => g.id === b.active) ? b.active : (games[0]?.id ?? null) };
}

export function useGame(bundle: CaseBundle, clock: () => number = Date.now): Game {
  const [board, setBoard] = useState<Board>(() => boardFor(bundle));
  const [now, setNow] = useState(clock);
  const [storageOk, setStorageOk] = useState(true);

  const dispatch = useCallback(
    (a: Action) =>
      setBoard((b) => {
        if (a.type === 'start') {
          const g = reduce(bundle, null, { ...a, id: a.id ?? newId(a.now) })!;
          return { games: [...b.games, g], active: g.id };
        }
        if (a.type === 'reset') {
          const games = b.games.filter((g) => g.id !== b.active);
          return { games, active: games[0]?.id ?? null };
        }
        const cur = b.games.find((g) => g.id === b.active);
        const next = cur && reduce(bundle, cur, a);
        return next && next !== cur ? { ...b, games: b.games.map((g) => (g === cur ? next : g)) } : b;
      }),
    [bundle],
  );
  const switchTo = useCallback((id: string) => setBoard((b) => (b.games.some((g) => g.id === id) ? { ...b, active: id } : b)), []);
  const put = useCallback(
    (s: GameState, activate = true) =>
      setBoard((b) => ({
        games: b.games.some((g) => g.id === s.id) ? b.games.map((g) => (g.id === s.id ? s : g)) : [...b.games, s],
        active: activate || !b.active ? s.id : b.active,
      })),
    [],
  );

  useEffect(() => {
    setStorageOk(saveBoard(board));
  }, [board]);

  // Інша вкладка (напр., відкрита QR-кодом із системної камери) записала прогрес — беремо його,
  // інакше наступне збереження цієї вкладки затерло б чужі рішення.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== STORAGE_KEY) return;
      setBoard(boardFor(bundle));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [bundle]);

  useEffect(() => {
    const tick = () => {
      const t = clock();
      setNow(t);
      setBoard((b) => {
        let changed = false;
        const games = b.games.map((g) => {
          const n = reduce(bundle, g, { type: 'tick', now: t })!;
          if (n !== g) changed = true;
          return n;
        });
        return changed ? { ...b, games } : b;
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [bundle, clock]);

  const state = board.games.find((g) => g.id === board.active) ?? null;
  return { state, games: board.games, dispatch, switchTo, put, now, storageOk };
}
