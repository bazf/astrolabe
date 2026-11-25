import { beforeAll, describe, expect, it, vi, afterEach } from 'vitest';
import { buildCase } from '../../../tools/build-content.ts';
import type { CaseBundle } from '../../../shared/case-types.ts';
import { reduce, elapsedMin, interviewStatus, visibleDocs, availableDecisions, optionsFor } from './reducer.ts';
import { checkAnswer } from './check.ts';
import { loadBoard, saveBoard, STORAGE_KEY } from './storage.ts';
import type { GameState } from './state.ts';

let bundle: CaseBundle;
beforeAll(async () => {
  bundle = await buildCase('content/cases/astrolabe');
}, 60_000);

const T0 = Date.UTC(2026, 10, 17, 18, 0, 0);
const min = (m: number) => T0 + m * 60_000;
const start = (level: 'trainee' | 'detective' = 'trainee') => reduce(bundle, null, { type: 'start', level, mode: 'competition', team: 'Сови', now: T0 })!;
const run = (s: GameState, ...actions: Parameters<typeof reduce>[2][]) => actions.reduce<GameState>((acc, a) => reduce(bundle, acc, a)!, s);

describe('events', () => {
  it('E1 fires at minute 8', () => {
    let s = run(start(), { type: 'tick', now: min(7.98) });
    expect(s.firedEvents).not.toContain('E1');
    s = run(s, { type: 'tick', now: min(8) });
    expect(s.firedEvents).toContain('E1');
    expect(s.pendingDecisions).toEqual(['R1']);
    expect(s.unlocked).toContain('C01');
  });

  it('interview before E1 fires E1 without counting the interview', () => {
    const s = run(start(), { type: 'interview', id: 'marta', now: min(2) });
    expect(s.firedEvents).toContain('E1');
    expect(s.interviewsDone).toEqual([]);
    expect(interviewStatus(bundle, s, 'marta')).toBe('needsDecision');
  });
});

describe('R1 and interview quota', () => {
  it('option a allows two interviews, then refuses', () => {
    let s = run(start(), { type: 'tick', now: min(8) }, { type: 'decide', decision: 'R1', option: 'a', now: min(9) });
    expect(s.flags.bayda_alert).toBe(true);
    expect(s.unlocked).toContain('C02');
    s = run(s, { type: 'interview', id: 'marta', now: min(10) }, { type: 'interview', id: 'korzh', now: min(11) });
    expect(interviewStatus(bundle, s, 'nelya')).toBe('quotaUsed');
    s = run(s, { type: 'interview', id: 'nelya', now: min(12) });
    expect(s.interviewsDone).toEqual(['marta', 'korzh']);
    expect(s.unlocked).toEqual(expect.arrayContaining(['C03', 'C06']));
    expect(s.flags.korzh_interviewed).toBe(true);
  });

  it('option c allows one interview and keeps Bayda calm', () => {
    let s = run(start(), { type: 'tick', now: min(8) }, { type: 'decide', decision: 'R1', option: 'c', now: min(9) });
    expect(s.flags.bayda_alert).toBeUndefined();
    s = run(s, { type: 'interview', id: 'stepan', now: min(10) });
    expect(interviewStatus(bundle, s, 'marta')).toBe('quotaUsed');
    expect(s.flags.stepan_contacted).toBe(true);
  });

  it('option b closes the case, penalizes and reopens after 3 minutes with the worse photo', () => {
    let s = run(start(), { type: 'tick', now: min(8) }, { type: 'decide', decision: 'R1', option: 'b', now: min(9) });
    expect(s.penaltyMin).toBe(5);
    expect(s.flags.case_closed).toBe(true);
    expect(interviewStatus(bundle, s, 'marta')).toBe('closed');
    s = run(s, { type: 'tick', now: min(11.9) });
    expect(s.flags.case_closed).toBe(true);
    s = run(s, { type: 'tick', now: min(12) });
    expect(s.flags.case_closed).toBe(false);
    expect(s.unlocked).toContain('C02b');
    expect(s.unlocked).not.toContain('C02');
    expect(s.firedEvents).toContain('E1reopen');
  });
});

describe('hints and time', () => {
  it('each hint costs the configured minutes', () => {
    const s = run(start(), { type: 'hint', task: 'Z1', now: min(1) }, { type: 'hint', task: 'Z1', now: min(2) });
    expect(s.hintsUsed.Z1).toBe(2);
    expect(elapsedMin(s, min(5))).toBe(5 + 2 * bundle.hintPenaltyMin);
  });

  it('caps hints at three', () => {
    const s = run(start(), ...[1, 2, 3, 4].map((m) => ({ type: 'hint' as const, task: 'Z1', now: min(m) })));
    expect(s.hintsUsed.Z1).toBe(3);
  });
});

describe('answers and gate A', () => {
  it('accepts a human-formatted right answer and opens envelope A', async () => {
    let s = start();
    const res = await checkAnswer(bundle, s, 'Z1', '1,8');
    expect(res.ok).toBe(true);
    s = run(s, { type: 'solved', task: 'Z1', canon: res.canon!, payload: res.payload, now: min(20) });
    expect(s.unlocked).toContain('section:A');
    expect(s.gatePayloads.A).toMatchObject({ envelope: 'A' });
    expect(s.inbox.some((m) => /конверт А/.test(m.text ?? ''))).toBe(true);
  });

  it('rejects a wrong answer', async () => {
    const res = await checkAnswer(bundle, start(), 'Z1', '0.6');
    expect(res).toEqual({ ok: false, canon: '0.6' });
  });

  it('accepts the optional choice task by surname', async () => {
    expect((await checkAnswer(bundle, start('detective'), 'Z2', 'Давид КОРЖ')).ok).toBe(true);
    expect((await checkAnswer(bundle, start(), 'Z2', 'Прокопчук')).ok).toBe(false);
  });

  it('a gate passed before the decision call shows the call instead of deciding silently', () => {
    const s = run(start(), { type: 'solved', task: 'Z1', canon: '1.8', payload: { envelope: 'A', message: 'x', unlock: ['section:A'] }, now: min(6) });
    expect(s.decisions.R1).toBeUndefined();
    expect(s.firedEvents).toContain('E1');
    expect(s.pendingDecisions).toEqual(['R1']);
  });
});

describe('archive', () => {
  it('shows open docs of the start section and unlocked ones only', () => {
    let s = start();
    expect(visibleDocs(bundle, s).map((d) => d.id)).toEqual(['1-09', '1-11']);
    s = run(s, { type: 'tick', now: min(8) });
    expect(visibleDocs(bundle, s).map((d) => d.id)).toContain('C01');
  });
});

describe('storage', () => {
  afterEach(() => vi.unstubAllGlobals());
  const memStorage = (mem: Map<string, string>) => ({ getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });

  it('restores every team after reload', () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', memStorage(mem));
    const a = run(start(), { type: 'tick', now: min(8) }, { type: 'decide', decision: 'R1', option: 'a', now: min(9) });
    const b = reduce(bundle, null, { type: 'start', level: 'detective', mode: 'competition', team: 'Лиси', now: min(1) })!;
    expect(saveBoard({ games: [a, b], active: b.id })).toBe(true);
    expect(mem.has(STORAGE_KEY)).toBe(true);
    expect(loadBoard()).toEqual({ games: [a, b], active: b.id });
  });

  it('moves an old single-game save onto the board', () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', memStorage(mem));
    const { id: _id, log: _log, ...old } = run(start(), { type: 'tick', now: min(8) });
    mem.set('astrolabe:v1', JSON.stringify(old));
    const board = loadBoard();
    expect(board.games).toHaveLength(1);
    expect(board.games[0]).toMatchObject({ team: 'Сови', id: T0.toString(36), log: [] });
    expect(board.active).toBe(T0.toString(36));
  });

  it('survives storage that throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => {} });
    expect(saveBoard({ games: [start()], active: null })).toBe(false);
    expect(loadBoard()).toEqual({ games: [], active: null });
  });

  it('ignores corrupted saves', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{not json', setItem: () => {}, removeItem: () => {} });
    expect(loadBoard()).toEqual({ games: [], active: null });
  });
});

describe('review fixes', () => {
  it('accepts a surname written with initials or punctuation', async () => {
    for (const raw of ['Д. Корж', 'Корж Д.О.', 'Корж.', 'Kорж']) expect((await checkAnswer(bundle, start(), 'Z2', raw)).ok, raw).toBe(true);
  });

  it('locks a task for 30 s after every third wrong answer', () => {
    let s = run(start(), { type: 'wrong', task: 'Z1', now: min(1) }, { type: 'wrong', task: 'Z1', now: min(1.1) });
    expect(s.wrong.Z1.lockedUntil).toBe(0);
    s = run(s, { type: 'wrong', task: 'Z1', now: min(1.2) });
    expect(s.wrong.Z1).toEqual({ count: 3, lockedUntil: min(1.2) + 30_000 });
    expect(s.penaltyMin).toBe(0);
  });
});

describe('act 2 engine features', () => {
  const withGateA = () =>
    run(start(), { type: 'tick', now: min(8) }, { type: 'decide', decision: 'R1', option: 'a', now: min(9) }, { type: 'solved', task: 'Z1', canon: '1.8', payload: { envelope: 'A', message: 'x', unlock: ['section:A'] }, now: min(20) });

  it('a document code fires the event that asks for its decision', () => {
    const s = run(withGateA(), { type: 'code', code: 212, now: min(21) });
    expect(s.firedEvents).toContain('E-R3');
    expect(s.pendingDecisions).toContain('R3');
  });

  it('an event can fire a set time after a gate', () => {
    let s = run(withGateA(), { type: 'tick', now: min(27.9) });
    expect(s.firedEvents).not.toContain('E-R3');
    s = run(s, { type: 'tick', now: min(28) });
    expect(s.firedEvents).toContain('E-R3');
  });

  it('a code before its section is open does nothing', () => {
    const s = run(start(), { type: 'code', code: 212, now: min(2) });
    expect(s.firedEvents).not.toContain('E-R3');
  });

  it('detaining Korzh can be undone any time with the release decision', () => {
    let s = run(withGateA(), { type: 'code', code: 212, now: min(21) }, { type: 'decide', decision: 'R3', option: 'a', now: min(22) });
    expect(s.flags).toMatchObject({ korzh_detained: true, killer_relaxed: true });
    expect(availableDecisions(bundle, s)).toContain('R3release');
    s = run(s, { type: 'decide', decision: 'R3release', option: 'release', now: min(30) });
    expect(s.flags).toMatchObject({ korzh_detained: false, killer_relaxed: false, korzh_released: true });
    expect(availableDecisions(bundle, s)).not.toContain('R3release');
  });

  it('the consultant option needs a prior interview with Korzh', () => {
    const s = run(withGateA(), { type: 'code', code: 212, now: min(21) });
    expect(optionsFor(bundle, s, 'R3')).toEqual(['a', 'b']);
  });

  it('a fast team still gets R3 and R7 to decide when it reaches gate B early', async () => {
    let s = withGateA();
    const res = await checkAnswer(bundle, s, 'Z3', '8,45');
    expect(res.ok).toBe(true);
    s = run(s, { type: 'solved', task: 'Z3', canon: res.canon!, payload: res.payload, now: min(23) });
    expect(s.decisions.R3).toBeUndefined();
    expect(s.pendingDecisions).toEqual(expect.arrayContaining(['R3', 'R7']));
    expect(s.unlocked).toContain('section:B');
  });

  it('decisions the team saw but ignored default at their gate with a notice', async () => {
    let s = run(withGateA(), { type: 'code', code: 212, now: min(21) }, { type: 'code', code: 214, now: min(21) });
    const res = await checkAnswer(bundle, s, 'Z3', '8,45');
    s = run(s, { type: 'solved', task: 'Z3', canon: res.canon!, payload: res.payload, now: min(40) });
    expect(s.decisions).toMatchObject({ R3: 'b', R7: 'c' });
    expect(s.flags.leak).toBe(true);
    const ids = s.inbox.map((m) => m.messageId);
    expect(ids).toContain(bundle.deadlineNotice);
    expect(ids).toContain('@r3.after.b');
  });

  it('the reducer refuses decisions that are not open or options whose condition fails', () => {
    let s = withGateA();
    s = run(s, { type: 'decide', decision: 'R3', option: 'a', now: min(21) });
    expect(s.decisions.R3).toBeUndefined();
    s = run(s, { type: 'code', code: 212, now: min(21) }, { type: 'decide', decision: 'R3', option: 'c', now: min(22) });
    expect(s.decisions.R3).toBeUndefined();
    s = run(s, { type: 'decide', decision: 'R3release', option: 'release', now: min(22) });
    expect(s.decisions.R3release).toBeUndefined();
  });

  it('detective answers gate B with grams of missing gold', async () => {
    expect((await checkAnswer(bundle, start('detective'), 'Z3', '302 г')).ok).toBe(true);
    expect((await checkAnswer(bundle, start('detective'), 'Z3', '8,45')).ok).toBe(false);
  });
});

describe('act 3 on the real case', () => {
  const toGateB = async (level: 'trainee' | 'detective' = 'trainee') => {
    let s = run(start(level), { type: 'tick', now: min(8) }, { type: 'decide', decision: 'R1', option: 'a', now: min(9) });
    for (const [task, raw, at] of [['Z1', '1,8', 20], ['Z3', level === 'trainee' ? '8,45' : '302', 40]] as const) {
      const r = await checkAnswer(bundle, s, task, raw);
      s = run(s, { type: 'solved', task, canon: r.canon!, payload: r.payload, now: min(at) });
    }
    return s;
  };

  it('Solomiya calls at minute 40 after gate B', async () => {
    let s = await toGateB();
    s = run(s, { type: 'tick', now: min(40) });
    expect(s.pendingDecisions).toContain('R6');
  });

  it('gate C opens envelope B billing and Stepan calls three minutes later', async () => {
    let s = await toGateB();
    const r = await checkAnswer(bundle, s, 'Z4', '0.40');
    expect(r.ok).toBe(true);
    s = run(s, { type: 'solved', task: 'Z4', canon: r.canon!, payload: r.payload, now: min(55) });
    expect(s.unlocked).toEqual(expect.arrayContaining(['section:C', 'C07']));
    s = run(s, { type: 'tick', now: min(57.9) });
    expect(s.pendingDecisions).not.toContain('R5');
    s = run(s, { type: 'tick', now: min(58) });
    expect(s.pendingDecisions).toContain('R5');
  });

  it('postponing Stepan poisons him; a correct dose in time saves him', async () => {
    let s = await toGateB();
    const r = await checkAnswer(bundle, s, 'Z4', '00:40');
    s = run(s, { type: 'solved', task: 'Z4', canon: r.canon!, payload: r.payload, now: min(55) }, { type: 'tick', now: min(58) }, { type: 'decide', decision: 'R5', option: 'c', now: min(59) }, { type: 'tick', now: min(67) });
    expect(s.flags.poisoned).toBe(true);
    expect(s.unlocked).toContain('C15');
    const dose = await checkAnswer(bundle, s, 'Z10', '1,44 мг');
    expect(dose.ok).toBe(true);
    s = run(s, { type: 'solved', task: 'Z10', canon: dose.canon!, now: min(68) }, { type: 'tick', now: min(71) });
    expect(s.flags.stepan_saved).toBe(true);
    expect(s.flags.stepan_dead).toBeUndefined();
  });

  it('the bait goes safely only if Iryna trusts the team', async () => {
    let s = await toGateB();
    s = run(s, { type: 'code', code: 313, now: min(41) }, { type: 'decide', decision: 'R4', option: 'b', now: min(42) });
    const r = await checkAnswer(bundle, s, 'Z4', '00:40');
    s = run(s, { type: 'solved', task: 'Z4', canon: r.canon!, payload: r.payload, now: min(55) }, { type: 'tick', now: min(58) }, { type: 'decide', decision: 'R5', option: 'b', now: min(59) }, { type: 'tick', now: min(80) });
    expect(s.flags.stepan_safe).toBe(true);
    expect(s.flags.poisoned).toBeUndefined();
    expect(s.unlocked).toEqual(expect.arrayContaining(['C09', 'C10b']));
  });

  it('refuses the thermos task before the poisoning and after the death', async () => {
    let s = await toGateB();
    const dose = await checkAnswer(bundle, s, 'Z10', '1,44');
    s = run(s, { type: 'solved', task: 'Z10', canon: dose.canon!, now: min(41) });
    expect(s.solved.Z10).toBeUndefined();
    expect(s.flags.stepan_saved).toBeUndefined();
    const r = await checkAnswer(bundle, s, 'Z4', '00:40');
    s = run(s, { type: 'solved', task: 'Z4', canon: r.canon!, payload: r.payload, now: min(55) }, { type: 'tick', now: min(58) }, { type: 'decide', decision: 'R5', option: 'c', now: min(59) }, { type: 'tick', now: min(67) }, { type: 'tick', now: min(72) });
    // вікно токсиколога — 6 хв після отруєння (67-ма хв)
    expect(s.flags.stepan_dead).toBeUndefined();
    s = run(s, { type: 'tick', now: min(73) });
    expect(s.flags.stepan_dead).toBe(true);
    s = run(s, { type: 'solved', task: 'Z10', canon: dose.canon!, now: min(74) });
    expect(s.flags.stepan_saved).toBeUndefined();
  });

  it('Stepan calls only once even if interviewed after his first call', async () => {
    let s = await toGateB();
    const r = await checkAnswer(bundle, s, 'Z4', '00:40');
    s = run(s, { type: 'solved', task: 'Z4', canon: r.canon!, payload: r.payload, now: min(55) }, { type: 'tick', now: min(58) });
    s = run(s, { type: 'interview', id: 'stepan', now: min(59) }, { type: 'tick', now: min(60) });
    expect(s.firedEvents).not.toContain('E3a');
    expect(s.pendingDecisions.filter((d) => d === 'R5')).toHaveLength(1);
  });

  it('accepts the shadow and route answers on both levels', async () => {
    expect((await checkAnswer(bundle, start(), 'Z5', '17:10')).ok).toBe(true);
    expect((await checkAnswer(bundle, start(), 'Z5', '10:00')).ok).toBe(false);
    expect((await checkAnswer(bundle, start(), 'Z9', '23 хв')).ok).toBe(true);
    expect((await checkAnswer(bundle, start('detective'), 'Z9', '0:45')).ok).toBe(true);
    expect((await checkAnswer(bundle, start('detective'), 'Z10', '0,0157')).ok).toBe(true);
  });
});
