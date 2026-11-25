import { beforeAll, describe, expect, it } from 'vitest';
import { buildCase } from '../../../tools/build-content.ts';
import type { CaseBundle } from '../../../shared/case-types.ts';
import { checkAnswer } from './check.ts';
import { reduce } from './reducer.ts';
import type { Action, GameState } from './state.ts';
import { decodeGame, encodeGame, mergeGame, mergeLogs, replayGame, toSyncData } from './sync.ts';

let bundle: CaseBundle;
beforeAll(async () => {
  bundle = await buildCase('content/cases/astrolabe');
}, 60_000);

const T0 = Date.UTC(2026, 10, 18, 9, 0, 0);
const min = (m: number) => T0 + m * 60_000;
const run = (s: GameState, ...as: Action[]) => as.reduce<GameState>((acc, a) => reduce(bundle, acc, a)!, s);
const start = () => reduce(bundle, null, { type: 'start', level: 'trainee', mode: 'competition', team: 'Сови', now: T0 })!;
async function solve(s: GameState, task: string, raw: string, at: number) {
  const r = await checkAnswer(bundle, s, task, raw);
  expect(r.ok, `${task} ${raw}`).toBe(true);
  return run(s, { type: 'solved', task, canon: r.canon!, payload: r.payload, now: at });
}
/** Те, що бачить гравець: без службових id повідомлень і часу подій. */
const view = (s: GameState) => ({
  decisions: s.decisions,
  solved: Object.keys(s.solved).sort(),
  unlocked: [...s.unlocked].sort(),
  flags: s.flags,
  hintsUsed: s.hintsUsed,
  interviewsDone: [...s.interviewsDone].sort(),
  penaltyMin: s.penaltyMin,
  firedEvents: [...s.firedEvents].sort(),
  pendingDecisions: [...s.pendingDecisions].sort(),
  gates: Object.keys(s.gatePayloads).sort(),
  inbox: s.inbox.map((m) => m.messageId ?? m.text).sort(),
});

async function actOne() {
  let s = run(start(), { type: 'tick', now: min(8) }, { type: 'decide', decision: 'R1', option: 'a', now: min(9) }, { type: 'interview', id: 'marta', now: min(10) });
  s = run(s, { type: 'hint', task: 'Z1', now: min(12) });
  return solve(s, 'Z1', '1,8', min(20));
}

describe('the action log', () => {
  it('records only the player actions that changed the game', async () => {
    let s = run(start(), { type: 'tick', now: min(8) }, { type: 'decide', decision: 'R1', option: 'a', now: min(9) }, { type: 'decide', decision: 'R1', option: 'b', now: min(9.5) });
    s = run(s, { type: 'interview', id: 'marta', now: min(10) }, { type: 'hint', task: 'Z1', now: min(12) }, { type: 'wrong', task: 'Z1', now: min(13) });
    s = await solve(s, 'Z1', '1,8', min(20));
    expect(s.log.map((e) => e.a)).toEqual([
      { type: 'decide', decision: 'R1', option: 'a' },
      { type: 'interview', id: 'marta' },
      { type: 'hint', task: 'Z1', n: 1 },
      { type: 'solved', task: 'Z1', canon: '1.8' },
    ]);
    expect(s.log.map((e) => e.at)).toEqual([min(9), min(10), min(12), min(20)]);
  });

  it('tells an interview that only called the boss apart from a real one', () => {
    const s = run(start(), { type: 'interview', id: 'marta', now: min(2) });
    expect(s.log.map((e) => e.a)).toEqual([{ type: 'interview', id: 'marta', trigger: true }]);
  });
});

describe('sharing a game between phones', () => {
  it('replaying the log reproduces the game, sealed envelopes included', async () => {
    const s = await actOne();
    const copy = await replayGame(bundle, toSyncData(s), min(21));
    expect(view(copy)).toEqual(view(run(s, { type: 'tick', now: min(21) })));
    expect(copy.id).toBe(s.id);
    expect(copy.startedAt).toBe(T0);
  });

  it('two phones that did different things agree after merging both ways', async () => {
    const a = await actOne();
    // Телефон Б приєднався на 9-й хвилині, далі грав сам.
    const early = await replayGame(bundle, toSyncData(run(start(), { type: 'tick', now: min(8) }, { type: 'decide', decision: 'R1', option: 'a', now: min(9) })), min(9));
    const b = run(early, { type: 'interview', id: 'nelya', now: min(11) }, { type: 'hint', task: 'Z1', now: min(14) });
    const ab = await mergeGame(bundle, a, toSyncData(b), min(25));
    const ba = await mergeGame(bundle, b, toSyncData(a), min(25));
    expect(view(ab)).toEqual(view(ba));
    expect(ab.interviewsDone.sort()).toEqual(['marta', 'nelya']);
    // підказка 1 до З-1 взята на обох телефонах — це та сама підказка
    expect(ab.hintsUsed.Z1).toBe(1);
    expect(ab.solved.Z1).toBeDefined();
  });

  it('the earlier decision wins', () => {
    const base = run(start(), { type: 'tick', now: min(8) });
    const a = run(base, { type: 'decide', decision: 'R1', option: 'a', now: min(10) });
    const b = run(base, { type: 'decide', decision: 'R1', option: 'b', now: min(9) });
    const merged = mergeLogs(a.log, b.log);
    expect(merged.map((e) => e.a)).toEqual([{ type: 'decide', decision: 'R1', option: 'b' }]);
  });

  it('keeps what this phone has already read', async () => {
    const a = await actOne();
    const readAll = { ...a, inbox: a.inbox.map((m) => ({ ...m, read: true })) };
    const merged = await mergeGame(bundle, readAll, toSyncData(a), min(21));
    expect(merged.inbox.filter((m) => m.at <= min(20)).every((m) => m.read)).toBe(true);
  });

  it('packs a game into a short link-safe code and back', async () => {
    const s = await actOne();
    const code = await encodeGame(toSyncData(s));
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(600);
    expect(await decodeGame(code)).toEqual(toSyncData(s));
    expect(await decodeGame('not-a-game')).toBeNull();
  });
});

describe('review fixes: merging phones', () => {
  it('an explicit choice on one phone beats a deadline default from the other', async () => {
    const base = await actOne();
    const a = run(base, { type: 'code', code: 214, now: min(22) }, { type: 'decide', decision: 'R7', option: 'a', now: min(27) });
    expect(a.decisions.R7).toBe('a');
    const b = await solve(await replayGame(bundle, toSyncData(base), min(21)), 'Z3', '8,45', min(25));
    for (const merged of [await mergeGame(bundle, a, toSyncData(b), min(30)), await mergeGame(bundle, b, toSyncData(a), min(30))]) {
      expect(merged.decisions.R7).toBe('a');
      expect(merged.flags.dorosh_exposed).toBe(true);
      expect(merged.flags.leak).toBeFalsy();
    }
  });

  it('an interview that only called the boss stays a call after merging', async () => {
    const a = run(start(), { type: 'interview', id: 'marta', now: min(3) }, { type: 'decide', decision: 'R1', option: 'a', now: min(4) }, { type: 'interview', id: 'stepan', now: min(5) }, { type: 'interview', id: 'korzh', now: min(6) });
    expect(a.interviewsDone.sort()).toEqual(['korzh', 'stepan']);
    const b = run(await replayGame(bundle, toSyncData(start()), min(1)), { type: 'interview', id: 'nelya', now: min(2) }, { type: 'decide', decision: 'R1', option: 'a', now: min(2.5) });
    const merged = await mergeGame(bundle, a, toSyncData(b), min(7));
    expect(merged.interviewsDone.sort()).toEqual(['korzh', 'stepan']);
    expect(merged.flags.korzh_interviewed).toBe(true);
  });

  it('rejects links with malformed or oversized data', async () => {
    const s = await actOne();
    const d = toSyncData(s);
    const bad = [
      { ...d, team: 5 as unknown as string },
      { ...d, team: 'х'.repeat(200) },
      { ...d, log: [...d.log, { at: min(30), a: { type: 'penalty' as const, min: 'abc' as unknown as number, reason: 'gate:B' } }] },
      { ...d, log: [...d.log, { at: min(30), a: { type: 'penalty' as const, min: -5, reason: 'gate:B' } }] },
      { ...d, log: [...d.log, { at: min(30), a: { type: 'penalty' as const, min: 10, reason: 'будь-що' } }] },
      { ...d, log: [...d.log, { at: T0 + 1e12, a: { type: 'code' as const, code: 214 } }] },
      { ...d, log: [...d.log, { at: min(30), a: { type: 'hint' as const, task: 'Z1', n: 99 } }] },
      { ...d, log: Array.from({ length: 2000 }, (_, i) => ({ at: min(1), a: { type: 'code' as const, code: i } })) },
    ];
    for (const x of bad) expect(await decodeGame(await encodeGame(x)), JSON.stringify(x).slice(0, 80)).toBeNull();
    expect(await decodeGame('A'.repeat(20_000))).toBeNull();
  });
});
