import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildCase } from '../../../tools/build-content.ts';
import type { CaseBundle } from '../../../shared/case-types.ts';
import { nextGate, openGateFor, unlockHost } from './host.ts';
import { reduce } from './reducer.ts';
import { replayGame, toSyncData } from './sync.ts';

let bundle: CaseBundle;
beforeAll(async () => {
  bundle = await buildCase('content/cases/astrolabe');
}, 60_000);

const T0 = Date.UTC(2026, 10, 18, 9, 0, 0);
const min = (m: number) => T0 + m * 60_000;
const code = (parse(readFileSync('content/cases/astrolabe/case.yaml', 'utf8')) as { host: { code: string } }).host.code;
const start = (level: 'trainee' | 'detective' = 'trainee') => reduce(bundle, null, { type: 'start', level, mode: 'competition', team: 'Сови', now: T0 })!;

describe('the host console', () => {
  it('unlocks only with the host code', async () => {
    expect(await unlockHost(bundle, 'хибний')).toBeNull();
    expect((await unlockHost(bundle, code))?.tasks.length).toBe(bundle.tasks.length);
  });

  it('opens the next gate for a stuck team at a time cost', async () => {
    const host = (await unlockHost(bundle, code))!;
    const s = start('detective');
    expect(nextGate(bundle, s)).toBe('A');
    const n = (await openGateFor(bundle, s, host, min(30)))!;
    expect(n.gatePayloads.A).toBeDefined();
    expect(n.unlocked).toContain('section:A');
    expect(n.penaltyMin).toBe(10);
    expect(nextGate(bundle, n)).toBe('B');
    // на іншому телефоні команди — те саме
    const copy = await replayGame(bundle, toSyncData(n), min(31));
    expect(copy.penaltyMin).toBe(10);
    expect(copy.gatePayloads.A).toBeDefined();
  });

  it('does nothing once every gate is open or the case is closed', async () => {
    const host = (await unlockHost(bundle, code))!;
    const closed = { ...start(), accusation: { answers: {}, correct: {}, at: min(80) } };
    expect(await openGateFor(bundle, closed, host, min(81))).toBeNull();
  });
});
