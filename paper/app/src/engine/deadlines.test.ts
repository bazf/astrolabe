// Що саме вирішить слідча, якщо команда зараз розкриє шлюз (для попередження на екрані завдання).
import { describe, expect, it } from 'vitest';
import type { CaseBundle } from '../../../shared/case-types.ts';
import { decisionsSettledBy, reduce } from './reducer.ts';
import type { Action, GameState } from './state.ts';

const T0 = 1_800_000_000_000;
const min = (m: number) => T0 + m * 60_000;

const bundle = {
  id: 't',
  title: 't',
  hintPenaltyMin: 3,
  deadlineNotice: '@n',
  docs: [],
  codes: [],
  interviews: [],
  db: [],
  dbSalt: 's',
  strings: {},
  geometry: {} as CaseBundle['geometry'],
  gates: { A: { task: 'G', sealed: {} as never }, B: { task: 'H', sealed: {} as never } },
  tasks: [
    { id: 'G', label: 'G', title: '@x', question: {} as never, gate: 'A', hints: {} as never, check: {} as never },
    { id: 'H', label: 'H', title: '@x', question: {} as never, gate: 'B', hints: {} as never, check: {} as never },
  ],
  decisions: [
    { id: 'SEEN', label: 'S', prompt: '@p', deadlineGate: 'A', defaultOption: 'x', options: [{ id: 'x', label: '@x' }] },
    { id: 'LATER', label: 'L', prompt: '@p', deadlineGate: 'A', defaultOption: 'x', options: [{ id: 'x', label: '@x' }] },
    { id: 'NEXT', label: 'N', prompt: '@p', deadlineGate: 'B', defaultOption: 'x', options: [{ id: 'x', label: '@x' }] },
  ],
  events: [
    { id: 'E-SEEN', at: { minute: 5 }, message: '@m', decision: 'SEEN' },
    { id: 'E-LATER', at: { minute: 30 }, message: '@m', decision: 'LATER' },
    { id: 'E-NEXT', at: { minute: 6 }, message: '@m', decision: 'NEXT' },
  ],
} as unknown as CaseBundle;

const run = (s: GameState | null, ...as: Action[]) => as.reduce<GameState>((acc, a) => reduce(bundle, acc, a)!, s as GameState);

describe('decisionsSettledBy', () => {
  it('names exactly the decisions the investigator will take for the team at this gate', () => {
    const s = run(null, { type: 'start', level: 'trainee', mode: 'competition', team: 'x', now: T0 }, { type: 'tick', now: min(10) });
    expect(s.pendingDecisions).toEqual(['SEEN', 'NEXT']);
    // SEEN — бачили, дедлайн A; LATER — ще не звучало, тож прозвучить зараз, а не вирішиться; NEXT — дедлайн B
    expect(decisionsSettledBy(bundle, s, 'A', min(10))).toEqual(['SEEN']);
    const solved = run(s, { type: 'solved', task: 'G', canon: '1', payload: { envelope: 'A', message: 'm', unlock: [] }, now: min(10) });
    expect(Object.keys(solved.decisions)).toEqual(['SEEN']);
    expect(solved.pendingDecisions).toEqual(['NEXT', 'LATER']);
    // LATER прозвучало на шлюзі А — тепер його дедлайн наступний шлюз
    expect(decisionsSettledBy(bundle, solved, 'B', min(12))).toEqual(['LATER', 'NEXT']);
  });

  it('is empty once the decisions are taken', () => {
    let s = run(null, { type: 'start', level: 'trainee', mode: 'competition', team: 'x', now: T0 }, { type: 'tick', now: min(10) });
    s = run(s, { type: 'decide', decision: 'SEEN', option: 'x', now: min(11) });
    expect(decisionsSettledBy(bundle, s, 'A', min(11))).toEqual([]);
  });
});
