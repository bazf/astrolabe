import type { Condition } from '../../../shared/case-types.ts';
import type { GameState } from './state.ts';

export function evalCondition(c: Condition | undefined, s: GameState): boolean {
  if (!c) return true;
  if ('all' in c) return c.all.every((x) => evalCondition(x, s));
  if ('any' in c) return c.any.some((x) => evalCondition(x, s));
  if ('not' in c) return !evalCondition(c.not, s);
  if ('decided' in c) return s.decisions[c.decided] === c.option;
  if ('unlocked' in c) return s.unlocked.includes(c.unlocked);
  if ('solved' in c) return !!s.solved[c.solved];
  if ('fired' in c) return s.firedEvents.includes(c.fired);
  if ('level' in c) return s.level === c.level;
  // безкоштовні підказки (скорочена партія) не рахуються
  if ('hintsAtMost' in c) return Object.entries(s.hintsUsed).reduce((a, [task, n]) => a + (s.freeHints?.includes(task) ? 0 : n), 0) <= c.hintsAtMost;
  return 'equals' in c ? s.flags[c.flag] === c.equals : Boolean(s.flags[c.flag]);
}
