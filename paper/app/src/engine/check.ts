import { canonForCheck } from '../../../shared/answers.ts';
import { hashAnswer, openSealed } from '../../../shared/seal.ts';
import type { CaseBundle } from '../../../shared/case-types.ts';
import type { GameState } from './state.ts';

export type CheckResult = { ok: boolean; canon: string | null; payload?: unknown };

/** Перевіряє відповідь без жодного відкритого правильного значення в збірці. */
export async function checkAnswer(bundle: CaseBundle, s: GameState, taskId: string, raw: string): Promise<CheckResult> {
  const task = bundle.tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, canon: null };
  const check = task.check[s.level];
  const canon = canonForCheck(check, raw);
  if (canon === null) return { ok: false, canon: null };
  // Прізвище з ініціалами («Д. Корж», «Корж Д. О.») — достатньо, щоб збіглося одне зі слів.
  const candidates = check.kind === 'text' ? [canon, ...canon.split(' ').filter((w) => w.length > 1)] : [canon];
  let matched: string | null = null;
  for (const c of candidates) {
    if (check.hashes.includes(await hashAnswer(check.salt, c))) {
      matched = c;
      break;
    }
  }
  if (matched === null) return { ok: false, canon };
  if (!task.gate) return { ok: true, canon: matched };
  const sealed = bundle.gates[task.gate]?.sealed[s.level];
  const payload = sealed ? await openSealed(sealed, matched) : null;
  return { ok: payload !== null, canon: matched, payload: payload ?? undefined };
}
