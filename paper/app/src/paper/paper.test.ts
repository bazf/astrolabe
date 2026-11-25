// Паперова партія на 40 хв: епілог збігається з рушієм застосунку, а вміст — повний і без слідів застосунку.
import { describe, expect, it } from 'vitest';
import { computeEpilogue } from '../engine/epilogue.ts';
import type { GameState } from '../engine/state.ts';
import type { CaseBundle } from '../../../shared/case-types.ts';
import { paperEpilogue, type PaperRun, type Place } from './epilogue.ts';
import { buildPaper } from '../../../tools/paper/content.ts';

const PLACES: (Place | undefined)[] = [undefined, 'tower', 'station', 'shop', 'home'];

/** Той самий перебіг партії — як стан застосунку. */
function toState(r: PaperRun): GameState {
  const poisoned = r.R5 === 'b' || r.R5 === 'c';
  const veis = r.R7 === 'b';
  const flags: Record<string, unknown> = {
    bayda_alert: true,
    ...(r.R3 === 'a' && !r.korzhReleased ? { korzh_detained: true } : {}),
    ...(r.R7 === 'a' ? { dorosh_exposed: true } : {}),
    ...(r.R7 === 'c' ? { leak: true } : {}),
    ...(veis ? { veis_caught: true, killer_alert: true } : {}),
    ...(r.R5 === 'a' ? { stepan_protected: true, killer_alert: true } : {}),
    ...(r.R5 === 'b' ? { killer_alert: true } : {}),
    ...(r.R5 === 'd' ? { stepan_fled: true } : {}),
    ...(poisoned ? { poisoned: true, ...(r.z10 ? { stepan_saved: true } : { stepan_dead: true }) } : {}),
    ...(r.R8 === 'a' ? { marta_deal: true } : r.R8 === 'b' ? { marta_charged: true } : {}),
    ...(r.op1 ? { op1: r.op1, op_done: true } : {}),
    ...(r.op2 ? { op2: r.op2 } : {}),
  };
  const solved: GameState['solved'] = {};
  for (const [k, v] of Object.entries(r.solved)) if (v) solved[k] = { canon: '', at: 0 };
  const unlocked = [r.R5 === 'a' && 'C10', r.R5 === 'b' && 'C10b', veis && 'C12', poisoned && 'C15'].filter(Boolean) as string[];
  const correct = { killer: r.accusation.killer === 'prokopchuk', remover: r.accusation.remover === 'hayovyi', place: r.accusation.place === 'tower', organizer: r.accusation.organizer === 'bayda' };
  return {
    flags,
    solved,
    unlocked,
    decisions: { R7: r.R7 },
    hintsUsed: {},
    startedAt: 0,
    penaltyMin: 0,
    accusation: { answers: r.accusation, correct, at: 0 },
  } as unknown as GameState;
}

function* runs(): Generator<PaperRun> {
  for (const R3 of ['a', 'b', 'c'] as const)
    for (const korzhReleased of [false, true])
      for (const R7 of ['a', 'b', 'c'] as const)
        for (const R5 of ['a', 'b', 'c', 'd'] as const)
          for (const z10 of [false, true])
            for (const R8 of ['a', 'b', 'c'] as const)
              for (const op1 of PLACES)
                for (const op2 of [undefined, 'tower'] as const)
                  for (const Z11 of [false, true])
                    for (const killer of ['prokopchuk', 'korzh', 'accident', 'bayda'])
                      for (const place of ['tower', 'shop'])
                        for (const organizer of ['bayda', 'veis'])
                          yield {
                            R3, korzhReleased: R3 === 'a' && korzhReleased, R7, R5, z10: (R5 === 'b' || R5 === 'c') && z10, R8, op1, op2: op1 ? op2 : undefined,
                            solved: { Z5: R8 !== 'b', Z6: R3 !== 'c', Z11 },
                            accusation: { killer, remover: R8 === 'a' ? 'hayovyi' : 'korzh', place, organizer },
                            hints: 2, finishMin: 37, gatePenaltyMin: 0,
                          };
}

describe('паперовий епілог', () => {
  it('осі, рядки, докази й розбір збігаються з рушієм застосунку для всіх перебігів', () => {
    const bundle = {} as CaseBundle;
    let n = 0;
    const bad: string[] = [];
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    for (const r of runs()) {
      const app = computeEpilogue(bundle, toState(r));
      const paper = paperEpilogue(r);
      const { time: _t, hints: _h, total: _x, ...rest } = paper.score;
      const { time: _t2, hints: _h2, ...appRest } = app.score.parts;
      const ok =
        same(paper.axes, app.axes) &&
        paper.evidence === app.evidence &&
        paper.killerPlace === app.places.killer &&
        same(paper.lines, { orest: app.lines.orest, dorosh: app.lines.dorosh, marta: app.lines.marta }) &&
        // З-9 у паперовій партії немає — застосунок завжди додав би «missRoute»
        same(paper.review, app.review.filter((x) => x !== 'missRoute')) &&
        same(rest, appRest);
      if (!ok && bad.length < 3) bad.push(JSON.stringify({ r, paper, app }));
      n++;
    }
    expect(bad).toEqual([]);
    expect(n).toBeGreaterThan(10_000);
  }, 120_000);

  it('бонус за час рахується від 40 хвилин зі штрафами', () => {
    const base = [...runs()][0];
    expect(paperEpilogue({ ...base, finishMin: 36, hints: 0, gatePenaltyMin: 0 }).score.time).toBe(4);
    expect(paperEpilogue({ ...base, finishMin: 36, hints: 1, gatePenaltyMin: 5 }).score.time).toBe(0);
  });
});

describe('паперовий вміст', () => {
  const p = buildPaper() as any;
  const text = JSON.stringify(p);
  const docs = p.envelopes.flatMap((e: any) => e.sheets.flatMap((s: any) => s.docs));
  const ids = new Set<string>(docs.map((d: any) => d.id));

  it('без нерозгорнутих ключів і без застосунку, QR та кодів АС-###', () => {
    expect(text).not.toMatch(/"@[a-z]/);
    expect(text).not.toMatch(/\$solve:|\$doc:/);
    expect(JSON.stringify(docs)).not.toMatch(/застосун|цифровому архіві|АС-\d|"code":/i);
    expect(JSON.stringify(p.tasks)).not.toMatch(/застосун|цифровому архіві|АС-\d/i);
  });

  it('кожне завдання має аркуш у конверті свого акту або раніше, а документи-джерела — теж', () => {
    const envOrder = ['folder', 'start', 'A', 'B', 'C'];
    const envOf = (id: string) => envOrder.indexOf(p.envelopes.find((e: any) => e.sheets.some((s: any) => s.docs.some((d: any) => d.id === id))).id);
    const sources: Record<string, string[]> = {
      Z1: ['1-01', '1-05', '1-06', '1-07', 'C02', '1-04'],
      Z3: ['2-02', '2-04'],
      Z4: ['3-01', '3-02'],
      Z5: ['3-05'],
      Z6: ['4-01', '4-02', '4-03'],
      Z11: ['4-09', 'C09', '1-12', '1-13', 'P03'],
    };
    for (const t of p.tasks.filter((t: any) => !t.branch)) {
      const sheet = docs.find((d: any) => d.component === 'PaperTaskSheet' && d.props.tasks.includes(t.id));
      expect(sheet, t.id).toBeTruthy();
      for (const src of sources[t.id]) expect(envOf(src), `${t.id} ← ${src}`).toBeLessThanOrEqual(envOf(sheet.id));
    }
  });

  it('гілкові документи лежать у пачці ведучого, а не в конвертах', () => {
    for (const d of p.outcomeDocs) expect(ids.has(d.id), d.id).toBe(false);
    for (const dec of p.decisions) for (const o of dec.options) for (const g of o.give ?? []) expect(p.outcomeDocs.some((d: any) => d.id === g), g).toBe(true);
  });

  it('таймлайн вміщується в 40 хвилин', () => {
    const last = p.timeline.at(-1).when.split('–')[1];
    expect(Number(last)).toBeLessThanOrEqual(p.durationMin);
    expect(p.checkpoints.every((c: any) => c.by < 36)).toBe(true);
  });
});
