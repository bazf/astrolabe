import type { CaseBundle } from '../../../shared/case-types.ts';
import type { GameState } from './state.ts';
import { evalCondition } from './conditions.ts';

/**
 * Події, які мали статися до моменту `now` і ще не відбулися, — з часом, коли кожна мала статися,
 * від найранішої. Час події не залежить від того, коли пристрій «прокинувся» (сон телефона, злиття).
 */
export function dueEvents(bundle: CaseBundle, s: GameState, now: number): { id: string; at: number }[] {
  const due: { id: string; at: number }[] = [];
  for (const e of bundle.events) {
    if (s.firedEvents.includes(e.id) || !evalCondition(e.requires, s)) continue;
    // Рішення вже кликала інша подія — другий «дзвінок» не потрібен.
    if (e.decision && (s.decisions[e.decision] || s.pendingDecisions.includes(e.decision))) continue;
    const hasMinute = e.at.minute !== undefined;
    const hasGate = e.at.afterGate !== undefined;
    if (!hasMinute && !hasGate) continue;
    // Якщо задано і хвилину, і шлюз — подія чекає на обидва.
    let at = hasMinute ? s.startedAt + e.at.minute! * 60_000 : -Infinity;
    if (hasGate) {
      const solved = s.solved[bundle.gates[e.at.afterGate!]?.task ?? ''];
      if (!solved) continue;
      at = Math.max(at, solved.at + (e.at.plusMin ?? 0) * 60_000);
    }
    if (at <= now) due.push({ id: e.id, at });
  }
  for (const sch of s.scheduled) {
    if (sch.dueAt > now || s.firedEvents.includes(sch.event) || due.some((d) => d.id === sch.event)) continue;
    const e = bundle.events.find((x) => x.id === sch.event);
    if (e && !evalCondition(e.requires, s)) continue;
    due.push({ id: sch.event, at: sch.dueAt });
  }
  return due.sort((a, b) => a.at - b.at);
}
