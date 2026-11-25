import { beforeAll, describe, expect, it } from 'vitest';
import { buildCase } from '../../../tools/build-content.ts';
import type { CaseBundle } from '../../../shared/case-types.ts';
import { reduce } from './reducer.ts';
import type { GameState } from './state.ts';
import { computeEpilogue, epilogueKeys } from './epilogue.ts';

let bundle: CaseBundle;
beforeAll(async () => {
  bundle = await buildCase('content/cases/astrolabe');
}, 60_000);

const T0 = Date.UTC(2026, 10, 18, 18, 0, 0);
const min = (m: number) => T0 + m * 60_000;
const ALL_RIGHT = { killer: true, remover: true, place: true, organizer: true };

function game(opts: { flags?: Record<string, unknown>; solved?: string[]; unlocked?: string[]; answers?: Record<string, string>; correct?: Record<string, boolean>; hints?: number; at?: number }): GameState {
  let s = reduce(bundle, null, { type: 'start', level: 'trainee', mode: 'competition', team: 'x', now: T0 })!;
  s = {
    ...s,
    flags: { ...s.flags, ...(opts.flags ?? {}) },
    solved: Object.fromEntries((opts.solved ?? []).map((t) => [t, { canon: 'x', at: min(10) }])),
    unlocked: [...s.unlocked, ...(opts.unlocked ?? [])],
    hintsUsed: opts.hints ? { Z1: opts.hints } : {},
  };
  return {
    ...s,
    accusation: {
      answers: opts.answers ?? { killer: 'prokopchuk', remover: 'hayovyi', place: 'tower', organizer: 'bayda' },
      correct: opts.correct ?? ALL_RIGHT,
      at: opts.at ?? min(80),
    },
  };
}

describe('computeEpilogue', () => {
  it('a careful team gets the best ending', () => {
    const e = computeEpilogue(bundle, game({ flags: { op1: 'home', stepan_safe: true }, solved: ['Z5', 'Z9', 'Z6', 'Z7'] }));
    expect(e.axes).toEqual({ killer: 'convicted', astrolabe: 'museum', stepan: 'alive', korzh: 'free', scheme: 'exposed' });
    expect(e.lines.orest).toBe('hero');
    expect(e.score.total).toBe(30 + 20 + 15 + 10 + 15 + 5 + 10);
    expect(e.review).toEqual([]);
  });

  it('an alerted killer flees to the station unless a group is there', () => {
    const away = computeEpilogue(bundle, game({ flags: { killer_alert: true, op1: 'home' }, solved: ['Z5', 'Z9'] }));
    expect(away.axes.killer).toBe('escaped');
    expect(away.review).toContain('alert');
    const there = computeEpilogue(bundle, game({ flags: { killer_alert: true, op1: 'tower', op2: 'station' }, solved: ['Z5', 'Z9'] }));
    expect(there.axes.killer).toBe('convicted');
  });

  it('a leak plus a solved cipher sends the killer to the tower and the astrolabe abroad', () => {
    const e = computeEpilogue(bundle, game({ flags: { leak: true, op1: 'station' }, solved: ['Z11', 'Z5', 'Z9'] }));
    expect(e.axes.killer).toBe('escaped');
    expect(e.axes.astrolabe).toBe('abroad');
    const caught = computeEpilogue(bundle, game({ flags: { leak: true, op1: 'tower' }, solved: ['Z11', 'Z5', 'Z9'] }));
    expect(caught.axes).toMatchObject({ killer: 'convicted', astrolabe: 'museum' });
    // утекла через витік, а не через тривогу: розбір не дорікає тривогою
    const leaked = computeEpilogue(bundle, game({ flags: { leak: true, killer_alert: true, op1: 'station' }, solved: ['Z11', 'Z5', 'Z9'] }));
    expect(leaked.review).toContain('leak');
    expect(leaked.review).not.toContain('alert');
  });

  it('accusing Korzh convicts an innocent man and costs points', () => {
    const e = computeEpilogue(bundle, game({ answers: { killer: 'korzh', remover: 'korzh', place: 'storage', organizer: 'veis' }, correct: { killer: false, remover: false, place: false, organizer: false }, flags: { op1: 'shop' } }));
    expect(e.axes).toMatchObject({ killer: 'innocent', korzh: 'convicted', astrolabe: 'hidden', scheme: 'hidden' });
    expect(e.lines.orest).toBe('shadow');
    expect(e.score.parts.killer).toBe(-20);
  });

  it('a sergeant caught by the false-information trap is exposed, not promoted', () => {
    const plain = computeEpilogue(bundle, game({ flags: { op1: 'home' }, solved: ['Z5', 'Z9'] }));
    expect(plain.lines.dorosh).toBe('promoted');
    const s = game({ flags: { op1: 'home', trap_set: true, veis_caught: true }, solved: ['Z5', 'Z9'] });
    expect(computeEpilogue(bundle, { ...s, decisions: { ...s.decisions, R7: 'b' } }).lines.dorosh).toBe('exposed');
  });

  it('the trap gives two proofs against Bayda — the caught dealer and the exposed sergeant', () => {
    const s = game({ flags: { op1: 'home', trap_set: true, veis_caught: true, bayda_alert: true }, solved: ['Z5', 'Z9'] });
    const e = computeEpilogue(bundle, { ...s, decisions: { ...s.decisions, R7: 'b' } });
    expect(e.axes.scheme).toBe('exposed');
    expect(e.review).not.toContain('schemeProof2');
  });

  it('an alerted Bayda with one proof gets the two-proof review line', () => {
    const e = computeEpilogue(bundle, game({ flags: { op1: 'home', bayda_alert: true }, solved: ['Z5', 'Z9', 'Z7'] }));
    expect(e.axes.scheme).toBe('hidden');
    expect(e.review).toContain('schemeProof2');
    expect(epilogueKeys()).toContain('epi.review.schemeProof2');
  });

  it('the review explains a hidden scheme and a dead witness, so the team knows what would have helped', () => {
    const unnamed = computeEpilogue(bundle, game({ flags: { op1: 'home', stepan_dead: true }, solved: ['Z5', 'Z9'], answers: { killer: 'prokopchuk', remover: 'hayovyi', place: 'tower', organizer: 'veis' }, correct: { ...ALL_RIGHT, organizer: false } }));
    expect(unnamed.axes.scheme).toBe('hidden');
    expect(unnamed.review).toEqual(expect.arrayContaining(['schemeName', 'stepanDead']));
    const noProof = computeEpilogue(bundle, game({ flags: { op1: 'home', stepan_safe: true }, solved: ['Z5', 'Z9'] }));
    expect(noProof.axes.scheme).toBe('hidden');
    expect(noProof.review).toContain('schemeProof');
    expect(noProof.review).not.toContain('stepanDead');
    for (const k of ['schemeName', 'schemeProof', 'stepanDead']) expect(epilogueKeys()).toContain(`epi.review.${k}`);
  });

  it('a caught killer walks free without enough evidence', () => {
    const e = computeEpilogue(bundle, game({ flags: { op1: 'home' }, solved: ['Z5'] }));
    expect(e.axes.killer).toBe('acquitted');
    expect(e.review).toEqual(expect.arrayContaining(['missRoute', 'missLedger', 'missWitness']));
  });

  it('an alerted Bayda needs two proofs; the Veis trap and Marta deal count', () => {
    expect(computeEpilogue(bundle, game({ flags: { bayda_alert: true, op1: 'home' }, solved: ['Z7'] })).axes.scheme).toBe('hidden');
    expect(computeEpilogue(bundle, game({ flags: { bayda_alert: true, marta_deal: true, veis_caught: true, op1: 'home' } })).axes.scheme).toBe('exposed');
  });

  it('a group at the shop catches Veis, which counts as evidence', () => {
    const e = computeEpilogue(bundle, game({ flags: { op1: 'shop' }, solved: ['Z5'] }));
    expect(e.axes.killer).toBe('convicted');
    expect(e.axes.scheme).toBe('exposed');
  });

  it('Stepan, Korzh, side lines and time bonus', () => {
    const e = computeEpilogue(bundle, game({ flags: { op1: 'home', stepan_dead: true, korzh_detained: true, iryna_injured: true, story_published: true, dorosh_exposed: true, marta_charged: true }, solved: ['Z5', 'Z9'], hints: 2, at: min(70) }));
    expect(e.axes).toMatchObject({ stepan: 'dead', korzh: 'detained' });
    expect(e.lines).toMatchObject({ iryna: 'injured', solomiya: 'published', dorosh: 'exposed', marta: 'charged' });
    expect(e.score.parts.time).toBe(20);
    expect(e.score.parts.hints).toBe(-6);
  });

  it('Stepan survives only if someone protected, hid or saved him', () => {
    const stepan = (flags: Record<string, unknown>) => computeEpilogue(bundle, game({ flags: { op1: 'home', ...flags } })).axes.stepan;
    expect(stepan({ stepan_protected: true })).toBe('alive');
    expect(stepan({ stepan_safe: true })).toBe('alive');
    expect(stepan({ poisoned: true, stepan_saved: true })).toBe('hospital');
    expect(stepan({ stepan_fled: true })).toBe('fled');
    // нікого не приставили: отруєння стається й після звинувачення
    expect(stepan({})).toBe('dead');
    expect(stepan({ poisoned: true })).toBe('dead');
  });

  it('every text the epilogue can show exists', () => {
    for (const key of epilogueKeys()) expect(bundle.strings, key).toHaveProperty(key);
  });
});
