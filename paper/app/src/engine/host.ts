// Пульт ведучого: розшифровка даних кодом ведучого і допомога команді, що застрягла.
import { canonForCheck } from '../../../shared/answers.ts';
import type { CaseBundle, GateId, HostData } from '../../../shared/case-types.ts';
import { openSealed } from '../../../shared/seal.ts';
import { GATE_ORDER, reduce } from './reducer.ts';
import type { GameState } from './state.ts';

export async function unlockHost(bundle: CaseBundle, raw: string): Promise<HostData | null> {
  const code = canonForCheck({ kind: 'text' }, raw);
  if (!bundle.host || !code) return null;
  return (await openSealed(bundle.host.sealed, code)) as HostData | null;
}

/** Перший шлюз, який команда ще не пройшла. */
export function nextGate(bundle: CaseBundle, s: GameState): GateId | null {
  return GATE_ORDER.find((g) => bundle.gates[g] && !s.gatePayloads[g]) ?? null;
}

/** Ведучий відкриває наступний шлюз за команду — зі штрафом часу. null — нема що відкривати. */
export async function openGateFor(bundle: CaseBundle, s: GameState, host: HostData, now: number): Promise<GameState | null> {
  const gate = nextGate(bundle, s);
  const g = gate && bundle.gates[gate];
  const canon = g && host.tasks.find((t) => t.id === g.task)?.levels[s.level].canon;
  if (!gate || !g || !canon) return null;
  const payload = await openSealed(g.sealed[s.level], canon);
  if (!payload) return null;
  const solved = reduce(bundle, s, { type: 'solved', task: g.task, canon, payload, now })!;
  if (solved === s) return null;
  return reduce(bundle, solved, { type: 'penalty', min: bundle.host?.gatePenaltyMin ?? 0, reason: `gate:${gate}`, now });
}
