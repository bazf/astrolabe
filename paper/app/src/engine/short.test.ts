import { beforeAll, describe, expect, it } from 'vitest';
import { buildCase } from '../../../tools/build-content.ts';
import type { CaseBundle, GateId } from '../../../shared/case-types.ts';
import { openSealed, SHORT_GAME_KEY } from '../../../shared/seal.ts';
import { checkAnswer } from './check.ts';
import { computeEpilogue } from './epilogue.ts';
import { evalCondition } from './conditions.ts';
import { elapsedMin, isOptional, reduce } from './reducer.ts';
import { startShort } from './short.ts';
import { replayGame, toSyncData } from './sync.ts';

let bundle: CaseBundle;
beforeAll(async () => {
  bundle = await buildCase('content/cases/astrolabe');
}, 60_000);

const T0 = Date.UTC(2026, 10, 18, 9, 0, 0);
const min = (m: number) => T0 + m * 60_000;
const short = () => startShort(bundle, { level: 'trainee', mode: 'competition', team: 'Сови', now: T0, id: 'g1' });

describe('the 60-minute game', () => {
  it('starts at minute 25 with envelope A open and the case opened officially', async () => {
    const s = await short();
    expect(s.short).toBe(true);
    expect(elapsedMin(s, T0)).toBe(25);
    expect(s.decisions.R1).toBe('a');
    expect(s.solved.Z1).toBeDefined();
    expect(s.unlocked).toContain('section:A');
    expect(s.unlocked).not.toContain('section:B');
    expect(s.gatePayloads.A).toBeDefined();
  });

  it('its key opens gate A only and is not an answer to anything', async () => {
    for (const g of ['B', 'C', 'D'] as GateId[]) for (const level of ['trainee', 'detective'] as const) expect(await openSealed(bundle.gates[g]!.sealed[level], SHORT_GAME_KEY), `${g} ${level}`).toBeNull();
    const s = reduce(bundle, null, { type: 'start', level: 'trainee', mode: 'competition', team: 'x', now: T0 })!;
    expect((await checkAnswer(bundle, s, 'Z1', SHORT_GAME_KEY)).ok).toBe(false);
  });

  it('makes Z2, Z7 and Z9 optional with free hints', async () => {
    let s = await short();
    expect(['Z2', 'Z7', 'Z9'].every((t) => isOptional(bundle, s, t))).toBe(true);
    expect(isOptional(bundle, s, 'Z3')).toBe(false);
    s = reduce(bundle, s, { type: 'hint', task: 'Z7', now: min(1) })!;
    expect(s.penaltyMin).toBe(0);
    s = reduce(bundle, s, { type: 'hint', task: 'Z3', now: min(2) })!;
    expect(s.penaltyMin).toBe(bundle.hintPenaltyMin);
    const full = reduce(bundle, null, { type: 'start', level: 'trainee', mode: 'competition', team: 'x', now: T0 })!;
    expect(isOptional(bundle, full, 'Z7')).toBe(true); // З-7 необов'язкова й у повній партії
    expect(isOptional(bundle, full, 'Z9')).toBe(false);
  });

  it('free hints do not cost the second group either', async () => {
    let s = await short();
    for (const task of ['Z7', 'Z7', 'Z7', 'Z9']) s = reduce(bundle, s, { type: 'hint', task, now: min(1) })!;
    expect(evalCondition({ hintsAtMost: 3 }, s)).toBe(true);
    s = reduce(bundle, s, { type: 'hint', task: 'Z3', now: min(2) })!;
    expect(evalCondition({ hintsAtMost: 0 }, s)).toBe(false);
  });

  it('counts only paid hints in the score', async () => {
    let s = await short();
    s = reduce(bundle, s, { type: 'hint', task: 'Z7', now: min(1) })!;
    s = reduce(bundle, s, { type: 'hint', task: 'Z3', now: min(2) })!;
    s = { ...s, accusation: { answers: {}, correct: {}, at: min(30) } };
    expect(computeEpilogue(bundle, s).score.parts.hints).toBe(-3);
  });

  it('stays short on another phone', async () => {
    const s = await short();
    const copy = await replayGame(bundle, toSyncData(s), min(1));
    expect(copy.short).toBe(true);
    expect(copy.startedAt).toBe(s.startedAt);
    expect(copy.decisions.R1).toBe('a');
    expect(copy.gatePayloads.A).toBeDefined();
  });
});
