// Епілог справи: п'ять осей, другорядні рядки, розбір і рахунок (біблія, розділ 11).
import type { CaseBundle } from '../../../shared/case-types.ts';
import { elapsedMin, freeHints } from './reducer.ts';
import type { GameState } from './state.ts';

export type Place = 'tower' | 'station' | 'shop' | 'home' | 'custody';
export type Epilogue = {
  axes: {
    killer: 'convicted' | 'acquitted' | 'escaped' | 'unnamed' | 'innocent' | 'accident';
    astrolabe: 'museum' | 'hidden' | 'abroad';
    stepan: 'alive' | 'hospital' | 'fled' | 'dead';
    korzh: 'free' | 'detained' | 'convicted';
    scheme: 'exposed' | 'hidden';
  };
  lines: {
    orest: 'hero' | 'shadow';
    iryna: 'injured' | 'safe';
    solomiya: 'exclusive' | 'published' | 'other';
    dorosh: 'exposed' | 'promoted';
    marta: 'deal' | 'charged' | 'free';
  };
  places: { killer: Place; veis: Place; groups: Place[] };
  evidence: number;
  review: string[];
  score: { parts: Record<'killer' | 'astrolabe' | 'stepan' | 'korzh' | 'scheme' | 'orest' | 'time' | 'hints', number>; total: number };
};

const REVIEW = ['missShadow', 'missRoute', 'missLedger', 'missWitness', 'leak', 'alert', 'korzh', 'wrongPlace', 'schemeName', 'schemeProof', 'schemeProof2', 'stepanDead'] as const;

/** Де вбивця в момент операції. */
export function killerPlace(s: GameState): Place {
  if (s.flags.leak && s.solved.Z11) return 'tower';
  if (s.flags.killer_alert) return 'station';
  return 'home';
}

export function computeEpilogue(_bundle: CaseBundle, s: GameState): Epilogue {
  const f = s.flags;
  const correct = s.accusation?.correct ?? {};
  const answers = s.accusation?.answers ?? {};
  const groups = [f.op1, f.op2].filter(Boolean) as Place[];
  const killer = killerPlace(s);
  const veis: Place = f.veis_caught ? 'custody' : killer === 'station' ? 'station' : 'shop';
  const veisCaught = veis === 'custody' || groups.includes(veis);

  const evidence = [s.solved.Z5, s.solved.Z9, s.solved.Z6, s.unlocked.includes('C10') || s.unlocked.includes('C10b'), s.unlocked.includes('C12') || veisCaught, s.unlocked.includes('C15')].filter(Boolean).length;

  let killerAxis: Epilogue['axes']['killer'];
  if (correct.killer) {
    const caught = killer === 'home' || groups.includes(killer);
    killerAxis = caught ? (evidence >= 2 ? 'convicted' : 'acquitted') : 'escaped';
  } else killerAxis = answers.killer === 'korzh' ? 'innocent' : answers.killer === 'accident' ? 'accident' : 'unnamed';

  const astrolabe: Epilogue['axes']['astrolabe'] =
    f.leak && s.solved.Z11 && !groups.includes('tower') ? 'abroad' : correct.place || groups.includes('tower') ? 'museum' : 'hidden';
  // Без охорони чи сховку отруєння стається, навіть якщо таймер ще не дійшов до кінця.
  const stepan: Epilogue['axes']['stepan'] = f.stepan_saved ? 'hospital' : f.stepan_fled ? 'fled' : !f.stepan_dead && (f.stepan_protected || f.stepan_safe) ? 'alive' : 'dead';
  const korzh: Epilogue['axes']['korzh'] = answers.killer === 'korzh' ? 'convicted' : f.korzh_detained ? 'detained' : 'free';
  // пастка з хибною інформацією (Р7-б) спрацювала — злив сержанта доведено
  const doroshExposed = !!f.dorosh_exposed || (s.decisions.R7 === 'b' && !!f.veis_caught);
  const proofs = [s.solved.Z7, f.marta_deal, veisCaught, doroshExposed].filter(Boolean).length;
  const scheme: Epilogue['axes']['scheme'] = correct.organizer && proofs >= (f.bayda_alert ? 2 : 1) ? 'exposed' : 'hidden';

  const lines: Epilogue['lines'] = {
    orest: correct.remover ? 'hero' : 'shadow',
    iryna: f.iryna_injured ? 'injured' : 'safe',
    solomiya: f.solomiya_exclusive ? 'exclusive' : f.story_published ? 'published' : 'other',
    dorosh: doroshExposed ? 'exposed' : 'promoted',
    marta: f.marta_deal ? 'deal' : f.marta_charged ? 'charged' : 'free',
  };

  const review: string[] = [];
  if (killerAxis !== 'convicted') {
    if (!s.solved.Z5) review.push('missShadow');
    if (!s.solved.Z9) review.push('missRoute');
    if (!s.solved.Z6) review.push('missLedger');
    if (!(s.unlocked.includes('C10') || s.unlocked.includes('C10b'))) review.push('missWitness');
  }
  if (f.leak) review.push('leak');
  if (killerAxis === 'escaped' && killer === 'station') review.push('alert');
  if (f.korzh_detained) review.push('korzh');
  if (killerAxis === 'escaped') review.push('wrongPlace');
  if (scheme === 'hidden') review.push(!correct.organizer ? 'schemeName' : f.bayda_alert ? 'schemeProof2' : 'schemeProof');
  if (stepan === 'dead') review.push('stepanDead');

  const KILLER = { convicted: 30, acquitted: 10, escaped: 10, unnamed: 0, accident: 0, innocent: -20 } as const;
  const hintsTotal = Object.entries(s.hintsUsed).reduce((a, [task, n]) => a + (freeHints(_bundle, s, task) ? 0 : n), 0);
  const at = s.accusation?.at ?? s.startedAt;
  const parts = {
    killer: KILLER[killerAxis],
    astrolabe: { museum: 20, hidden: 5, abroad: 0 }[astrolabe],
    stepan: { alive: 15, hospital: 15, fled: 10, dead: 0 }[stepan],
    korzh: { free: 10, detained: 3, convicted: 0 }[korzh],
    scheme: scheme === 'exposed' ? 15 : 0,
    orest: lines.orest === 'hero' ? 5 : 0,
    time: Math.max(0, Math.round(90 - elapsedMin(s, at))),
    hints: -3 * hintsTotal,
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);

  return { axes: { killer: killerAxis, astrolabe, stepan, korzh, scheme }, lines, places: { killer, veis, groups }, evidence, review, score: { parts, total } };
}

/** Ключі текстів епілогу (для перевірки повноти вмісту і для екрана). */
export function epilogueKeys(): string[] {
  const k: string[] = ['epi.title', 'epi.innocent', 'epi.review.title', 'epi.score.title', 'epi.score.total'];
  for (const h of ['convicted', 'acquitted', 'escaped', 'unnamed', 'innocent', 'accident']) k.push(`epi.headline.${h}`);
  for (const v of ['convicted', 'acquitted', 'escaped', 'unnamed']) k.push(`epi.killer.${v}`);
  for (const v of ['museum', 'hidden', 'abroad']) k.push(`epi.astrolabe.${v}`);
  for (const v of ['alive', 'hospital', 'fled', 'dead']) k.push(`epi.stepan.${v}`);
  for (const v of ['free', 'detained']) k.push(`epi.korzh.${v}`);
  for (const v of ['exposed', 'hidden']) k.push(`epi.scheme.${v}`);
  for (const v of ['hero', 'shadow']) k.push(`epi.orest.${v}`);
  for (const v of ['injured', 'safe']) k.push(`epi.iryna.${v}`);
  for (const v of ['exclusive', 'published', 'other']) k.push(`epi.solomiya.${v}`);
  for (const v of ['exposed', 'promoted']) k.push(`epi.dorosh.${v}`);
  for (const v of ['deal', 'charged', 'free']) k.push(`epi.marta.${v}`);
  for (const v of REVIEW) k.push(`epi.review.${v}`);
  return k;
}
