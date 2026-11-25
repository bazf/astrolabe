// Скорочена партія (біблія, розд. 5): перший акт ведучий видає розкритим.
import type { CaseBundle, Level, Mode } from '../../../shared/case-types.ts';
import { openSealed, SHORT_GAME_KEY } from '../../../shared/seal.ts';
import { reduce } from './reducer.ts';
import type { GameState } from './state.ts';

export async function startShort(bundle: CaseBundle, o: { level: Level; mode: Mode; team: string; now: number; id?: string }): Promise<GameState> {
  const cfg = bundle.short;
  if (!cfg) throw new Error('У справі немає скороченої партії');
  // Годинник одразу на offsetMin: події першого акту (дзвінок начальника) звучать, рішення по них ухвалено.
  let s = reduce(bundle, null, { type: 'start', ...o, short: true })!;
  s = reduce(bundle, s, { type: 'tick', now: o.now })!;
  for (const [decision, option] of Object.entries(cfg.decide)) s = reduce(bundle, s, { type: 'decide', decision, option, now: o.now })!;
  const gate = bundle.gates[cfg.gate];
  const payload = gate ? await openSealed(gate.sealed[o.level], SHORT_GAME_KEY) : null;
  if (!gate || !payload) throw new Error(`Шлюз ${cfg.gate} не відкривається ключем скороченої партії`);
  return reduce(bundle, s, { type: 'solved', task: gate.task, canon: SHORT_GAME_KEY, payload, now: o.now })!;
}
