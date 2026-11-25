import { beforeAll, describe, expect, it } from 'vitest';
import { buildCase, validateCase } from './build-content.ts';
import { openSealed } from '../shared/seal.ts';
import { canonForCheck } from '../shared/answers.ts';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { HostData } from '../shared/case-types.ts';
import type { CaseBundle } from '../shared/case-types.ts';
import { reduce, visibleTasks } from '../app/src/engine/reducer.ts';
import { makeT } from '../app/src/documents/context.tsx';
// @ts-expect-error — JS-модуль без типів
import { solveAll } from './solve.mjs';

let bundle: CaseBundle;
beforeAll(async () => {
  bundle = await buildCase('content/cases/astrolabe');
}, 60_000);

const dist = (a: { x: number; y: number }) => Math.hypot(a.x, a.y);
const routeLen = (pts: [number, number][]) => pts.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0);

describe('buildCase', () => {
  it('produces a valid bundle', () => {
    expect(validateCase(bundle)).toEqual([]);
  });

  it('has unique codes', () => {
    const codes = bundle.codes.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('keeps the kit within 25 sheets and lays out sheets 1–12', () => {
    const sheets = new Set(bundle.docs.filter((d) => d.medium === 'paper').map((d) => d.sheet));
    expect(Math.max(...(sheets as Set<number>))).toBeLessThanOrEqual(25);
    for (let n = 1; n <= 12; n++) expect(sheets.has(n)).toBe(true);
  });

  it('matches map distances with the solver', () => {
    const solved = solveAll();
    const pts = bundle.geometry.town.points;
    const where: Record<string, string> = {
      'Тимур Савка': 'hotel',
      Прокопчук: 'stage',
      Байда: 'stage',
      Згурська: 'restaurant',
      'Ірина Гайова': 'crowd',
      Вейс: 'shop',
    };
    for (const row of solved.trap.rows as { who: string; dist: number }[]) {
      const key = where[row.who];
      if (!key) continue;
      expect(Math.abs(dist(pts[key]) - row.dist), row.who).toBeLessThanOrEqual(5);
    }
    const r = bundle.geometry.town.routes;
    expect(Math.abs(routeLen(r.viaPark.points) / 1000 - solved.route.viaParkMin / 60 * 5)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(routeLen(r.aroundPark.points) / 1000 - 1.9)).toBeLessThanOrEqual(0.05);
  });

  it('hides answers and texts', () => {
    const json = JSON.stringify(bundle);
    expect(json).not.toContain('"1.8"');
    expect(json).not.toContain('корж');
    expect(json).not.toContain('Чисто. Занадто чисто');
    expect(json).not.toContain('1647');
  });

  it('opens gate A only with the right answer', async () => {
    const sealed = bundle.gates.A!.sealed.trainee;
    expect(await openSealed(sealed, '1.8')).toMatchObject({ envelope: 'A', unlock: ['section:A'] });
    expect(await openSealed(sealed, '0.6')).toBeNull();
  });
});

describe('validateCase', () => {
  it('checks the short game setup', () => {
    const broken = { ...bundle, short: { offsetMin: 25, gate: 'E', decide: { R1: 'z', NOPE: 'a' }, optional: ['Z99'] } } as unknown as CaseBundle;
    const errors = validateCase(broken).join('\n');
    for (const bad of ['шлюзу E', 'R1/z', 'NOPE', 'Z99']) expect(errors).toContain(bad);
  });

  it('checks the task named by a lock-clearing effect', () => {
    const broken = { ...bundle, decisions: [{ id: 'W', label: 'W', prompt: '@p', options: [{ id: 'x', label: '@x', effects: [{ clearLock: 'NOPE' }] }] }] } as unknown as CaseBundle;
    expect(validateCase(broken).join('\n')).toContain('NOPE');
  });

  it('reports dangling references', () => {
    const broken = structuredClone(bundle);
    broken.events[0].effects = [{ unlock: 'NOPE' }];
    broken.codes.push({ code: 999, action: { interview: 'ghost' } });
    const errors = validateCase(broken);
    expect(errors.join('\n')).toMatch(/NOPE/);
    expect(errors.join('\n')).toMatch(/ghost/);
  });
});

describe('act files and police database', () => {
  it('merges acts/*.yaml into the bundle', () => {
    expect(bundle.tasks.map((t) => t.id)).toEqual(expect.arrayContaining(['Z1', 'Z2', 'Z3', 'Z7']));
    expect(Object.keys(bundle.gates).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(bundle.docs.some((d) => d.id === '2-02')).toBe(true);
  });

  it('finds database records only by an exact query, in any spelling', async () => {
    const { queryKeys } = await import('../shared/answers.ts');
    const { hashAnswer } = await import('../shared/seal.ts');
    const find = async (q: string) => {
      for (const k of queryKeys(q)) {
        const h = await hashAnswer(bundle.dbSalt, k);
        const hit = bundle.db.find((e) => e.hashes.includes(h));
        if (hit) return hit;
      }
      return undefined;
    };
    expect(await find('ВХ 4717 АК')).toBeTruthy();
    expect(await find('bx4717ak')).toBeTruthy();
    expect(await find('ТОВ «Реставр-Поділля»')).toBeTruthy();
    expect(await find('ВХ 47?7 А?')).toBeUndefined();
    for (const q of ['ТОВ «Байда-Буд»', 'ПрАТ «СК «Поділля-Гарант»', 'Неля Прокопчук', 'Прокопчук Н. В.', 'Гайовий О. М.', 'БФ «Відродження Старокаменя»']) expect(await find(q), q).toBeTruthy();
    expect(JSON.stringify(bundle.db)).not.toContain('Реставр');
  });
});

describe('the host console data', () => {
  const hostCode = () => (parse(readFileSync('content/cases/astrolabe/case.yaml', 'utf8')) as { host: { code: string } }).host.code;
  const open = async (code: string) => (bundle.host ? ((await openSealed(bundle.host.sealed, canonForCheck({ kind: 'text' }, code)!)) as HostData | null) : null);

  it('opens only with the host code and carries answers, solutions and the timeline', async () => {
    expect(await open('не той код')).toBeNull();
    const h = (await open(` ${hostCode().toUpperCase()} `))!;
    const z1 = h.tasks.find((t) => t.id === 'Z1')!;
    expect(z1.levels.trainee.answer).toBe('1,6–1,9 м/с');
    expect(await openSealed(bundle.gates.A!.sealed.trainee, z1.levels.trainee.canon)).not.toBeNull();
    expect(z1.levels.detective.solution.length).toBeGreaterThan(20);
    expect(h.tasks.find((t) => t.id === 'Z8')!.levels.detective.answer).toBe('161174');
    expect(h.tasks.find((t) => t.id === 'Z11')!.levels.trainee.answer).toBe('південний');
    const r1 = h.decisions.find((d) => d.id === 'R1')!;
    expect(r1.options.map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect(r1.options[0].after.join(' ').length).toBeGreaterThan(10);
    const rsafe = h.decisions.find((d) => d.id === 'R-SAFE')!;
    expect(rsafe.options[0].after).toHaveLength(2); // стажер і слідчий
    expect(h.timeline).toHaveLength(8);
    expect(h.notes.short).toContain('25:00');
    expect(bundle.host!.gatePenaltyMin).toBe(10);
  });

  it('gives the host the whole solution: briefing, preparation, scoring, the story and the accusation answers', async () => {
    const h = (await open(hostCode()))!;
    for (const k of ['briefing', 'prep', 'scoring', 'solution'] as const) expect(h.notes[k].length, k).toBeGreaterThan(80);
    expect(h.accusation.map((q) => q.prompt)).toEqual(['Хто вбив Ореста Гайового?', 'Хто зняв оригінал астролябії з вітрини?', 'Де оригінал зараз?', 'Хто організував схему вивезення астролябії?']);
    expect(h.accusation[0].answer).toBe('Прокопчук Неля Василівна');
    expect(h.accusation[2].answer).toBe('Годинникова вежа, ніша за південним циферблатом');
  });

  it('a guess at the host code costs a full key derivation, not one hash', () => {
    expect(Object.keys(bundle.host!.sealed.wraps)).toEqual(['*']);
  });

  it('leaves no host text or code in the bundle', () => {
    const json = JSON.stringify(bundle);
    expect(json).not.toContain(hostCode());
    expect(json).not.toContain('Тут відповіді, розв');
    expect(Object.keys(bundle.strings).filter((k) => k.startsWith('host.'))).toEqual([]);
  });
});

describe('departments', () => {
  it('every gate needs conclusions from two departments, as in the bible', () => {
    const depts = (id: string) => bundle.tasks.find((t) => t.id === id)?.depts;
    for (const id of ['Z1', 'Z3', 'Z8']) expect(depts(id)?.length, id).toBeGreaterThanOrEqual(2);
    for (const t of bundle.tasks) expect(t.depts?.length, t.id).toBeGreaterThan(0);
    const dept = (id: string) => bundle.docs.find((d) => d.id === id)?.dept;
    expect(dept('2-02')).toBe('A'); // інвентарна картка — облік музею
    expect(dept('4-07')).toBe('O'); // фото кабінету
  });
});

describe('the accusation form', () => {
  it('lists every question in alphabetical order, so position gives nothing away', async () => {
    const { deobfuscate } = await import('../shared/seal.ts');
    const text = (ref: string) => deobfuscate(bundle.strings[ref.slice(1)]);
    for (const q of bundle.accusation) {
      const labels = q.options.map((o) => text(o.label));
      expect(labels, q.id).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'uk')));
    }
  });

  it('a warrant lifts the safe lock', () => {
    const warrant = bundle.decisions.find((d) => d.id === 'R-SAFE')!.options[0].effects;
    expect(warrant).toContainEqual({ clearLock: 'Z8' });
  });

  it('opens only after the operation and the second group', () => {
    expect(bundle.accusationOpen).toBeDefined();
  });

  it('hides the final tasks until their envelopes are open', () => {
    const when = (id: string) => bundle.tasks.find((t) => t.id === id)?.visibleWhen;
    expect(when('Z6')).toEqual({ unlocked: 'section:C' });
    expect(when('Z8')).toEqual({ unlocked: 'section:C' });
    expect(when('Z11')).toEqual({ unlocked: 'section:D' });
  });

  it('texts before the finale do not give away that the killer is a woman', () => {
    // епілог (act4: epi.*) знає правду; питання, підказки й повідомлення шлюзів — ні
    const before = ['act1', 'act2', 'act3'].map((a) => readFileSync(`content/cases/astrolabe/uk/${a}.yaml`, 'utf8')).join('\n');
    expect(before).not.toMatch(/вбивця (була|стояла|пішла)|та, хто стояла/);
  });

  it('gives the toxicologist six minutes and flags the dose task as urgent', () => {
    const e4 = bundle.events.find((e) => e.id === 'E4')!;
    expect(e4.effects).toContainEqual({ schedule: 'E4-DEAD', afterMin: 6 });
    expect(bundle.tasks.find((t) => t.id === 'Z10')!.urgent).toBe(true);
  });

  it('shows each act’s tasks only with its envelope — titles must not spoil later twists', () => {
    const T0 = 1_800_000_000_000;
    let s = reduce(bundle, null, { type: 'start', level: 'trainee', mode: 'competition', team: 'x', now: T0 })!;
    const seen = () => visibleTasks(bundle, s).map((t) => t.id).sort();
    expect(seen()).toEqual(['Z1', 'Z2']);
    const open = (gate: 'A' | 'B', task: string, min: number) =>
      (s = reduce(bundle, s, { type: 'solved', task, canon: 'x', payload: { envelope: gate, message: '', unlock: [`section:${gate}`] }, now: T0 + min * 60_000 })!);
    open('A', 'Z1', 20);
    expect(seen()).toEqual(['Z1', 'Z2', 'Z3', 'Z7']);
    open('B', 'Z3', 40);
    expect(seen()).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z7', 'Z9']);
  });
});

describe('solver tables injected into documents', () => {
  it('puts the sun table from the solver on task sheet 3', () => {
    const doc = bundle.docs.find((d) => d.id === '3-11')!;
    const trainee = (doc.levels!.trainee as { table: { rows: string[][] } }).table.rows;
    const detective = (doc.levels!.detective as { table: { rows: string[][] } }).table.rows;
    expect(trainee).toContainEqual(['17:10', '2,44']);
    expect(trainee).toContainEqual(['10:00', '1,73']);
    expect(trainee).toContainEqual(['09:00', '2,56']);
    expect(detective).toContainEqual(['17:10', '22,3']);
    expect(trainee.length).toBeGreaterThan(30);
  });
});

describe('sheet layout', () => {
  it('a sheet mixing documents of two envelopes is an error — it cannot go in both', async () => {
    const b = await buildCase('content/cases/astrolabe');
    const moved = { ...b, docs: b.docs.map((d) => (d.id === '2-02' ? { ...d, sheet: 12 } : d)) };
    expect(validateCase(moved).join('\n')).toMatch(/Аркуш 12/);
  }, 60_000);
});

describe('rules for players', () => {
  it('ships the full rules in the bundle, every section with text', async () => {
    const b = await buildCase('content/cases/astrolabe');
    const t = makeT(b);
    expect(t(b.rules!.title)).toBe('Як грати');
    expect(t(b.rules!.intro).length).toBeGreaterThan(200);
    expect(b.rules!.sections.length).toBeGreaterThanOrEqual(10);
    for (const s of b.rules!.sections) {
      expect(t(s.title), s.title).not.toMatch(/⟨/);
      expect(t(s.body).length, s.body).toBeGreaterThan(80);
    }
  }, 60_000);

  it('gives nothing away — no culprits, answers or twists', () => {
    const text = readFileSync('content/cases/astrolabe/uk/rules.yaml', 'utf8');
    for (const spoiler of ['Прокопчук', 'Неля', 'Байда', 'Вейс', 'Згурськ', 'Дорош', 'Корж', 'Луговий', '00:40', '22:10', 'циферблат', 'підмін']) expect(text, spoiler).not.toContain(spoiler);
    // корені слів — лише на початку слова (у «раніше», «складніші» вони не рахуються)
    for (const stem of ['ніш[аіуеою]', 'копі[яїюєй]']) expect(text, stem).not.toMatch(new RegExp(`(^|[^а-яіїєґ'’])${stem}`, 'i'));
  });
});
