// Епілог паперової партії (40 хв): ті самі осі й рахунок, що й у застосунку (engine/epilogue.ts),
// але з входами, які ведучий бачить на папері. Тест paper.test.ts звіряє з рушієм застосунку.

export type Place = 'tower' | 'station' | 'shop' | 'home';
export type PaperRun = {
  R3: 'a' | 'b' | 'c';
  /** Р3+ — Коржа звільнено після затримання */
  korzhReleased: boolean;
  R7: 'a' | 'b' | 'c';
  R5: 'a' | 'b' | 'c' | 'd';
  /** гілка отруєння (Р5 «б»/«в»): З-10 розв'язано вчасно */
  z10: boolean;
  R8: 'a' | 'b' | 'c';
  op1?: Place;
  op2?: Place;
  solved: { Z5: boolean; Z6: boolean; Z11: boolean };
  accusation: { killer: string; remover: string; place: string; organizer: string };
  hints: number;
  /** хвилина, коли подано звинувачення (за таймером) */
  finishMin: number;
  /** штраф ведучого за відкриті шлюзи, хв */
  gatePenaltyMin: number;
};

export const CORRECT = { killer: 'prokopchuk', remover: 'hayovyi', place: 'tower', organizer: 'bayda' } as const;

export type PaperEpilogue = {
  killerPlace: Place;
  veis: Place | 'custody';
  evidence: number;
  axes: {
    killer: 'convicted' | 'acquitted' | 'escaped' | 'unnamed' | 'innocent' | 'accident';
    astrolabe: 'museum' | 'hidden' | 'abroad';
    stepan: 'alive' | 'hospital' | 'fled' | 'dead';
    korzh: 'free' | 'detained' | 'convicted';
    scheme: 'exposed' | 'hidden';
  };
  lines: { orest: 'hero' | 'shadow'; dorosh: 'exposed' | 'promoted'; marta: 'deal' | 'charged' | 'free' };
  review: string[];
  score: Record<'killer' | 'astrolabe' | 'stepan' | 'korzh' | 'scheme' | 'orest' | 'time' | 'hints', number> & { total: number };
};

export const KILLER_POINTS = { convicted: 30, acquitted: 10, escaped: 10, unnamed: 0, accident: 0, innocent: -20 } as const;
export const ASTROLABE_POINTS = { museum: 20, hidden: 5, abroad: 0 } as const;
export const STEPAN_POINTS = { alive: 15, hospital: 15, fled: 10, dead: 0 } as const;
export const KORZH_POINTS = { free: 10, detained: 3, convicted: 0 } as const;

export function paperEpilogue(r: PaperRun, durationMin = 40, hintPenaltyMin = 3): PaperEpilogue {
  const leak = r.R7 === 'c';
  const veisCaughtByTrap = r.R7 === 'b';
  // Луговий під охороною або на зустрічі, або пастка з Вейсом — вбивця насторожі
  const alert = r.R5 === 'a' || r.R5 === 'b' || veisCaughtByTrap;
  const killerPlace: Place = leak && r.solved.Z11 ? 'tower' : alert ? 'station' : 'home';
  const groups = [r.op1, r.op2].filter((g): g is Place => !!g);
  const veis: Place | 'custody' = veisCaughtByTrap ? 'custody' : killerPlace === 'station' ? 'station' : 'shop';
  const veisCaught = veis === 'custody' || groups.includes(veis as Place);
  const poisoned = r.R5 === 'b' || r.R5 === 'c';

  const evidence = [r.solved.Z5, r.solved.Z6, r.R5 === 'a' || r.R5 === 'b', veisCaught, poisoned].filter(Boolean).length;

  const c = {
    killer: r.accusation.killer === CORRECT.killer,
    remover: r.accusation.remover === CORRECT.remover,
    place: r.accusation.place === CORRECT.place,
    organizer: r.accusation.organizer === CORRECT.organizer,
  };
  let killer: PaperEpilogue['axes']['killer'];
  if (c.killer) killer = killerPlace === 'home' || groups.includes(killerPlace) ? (evidence >= 2 ? 'convicted' : 'acquitted') : 'escaped';
  else killer = r.accusation.killer === 'korzh' ? 'innocent' : r.accusation.killer === 'accident' ? 'accident' : 'unnamed';

  const astrolabe: PaperEpilogue['axes']['astrolabe'] = leak && r.solved.Z11 && !groups.includes('tower') ? 'abroad' : c.place || groups.includes('tower') ? 'museum' : 'hidden';
  const stepan: PaperEpilogue['axes']['stepan'] = r.R5 === 'a' ? 'alive' : r.R5 === 'd' ? 'fled' : r.z10 ? 'hospital' : 'dead';
  const detained = r.R3 === 'a' && !r.korzhReleased;
  const korzh: PaperEpilogue['axes']['korzh'] = r.accusation.killer === 'korzh' ? 'convicted' : detained ? 'detained' : 'free';
  const doroshExposed = r.R7 === 'a' || (r.R7 === 'b' && veisCaughtByTrap);
  // Р1 ухвалено як «відкрити провадження» — Байда завжди насторожі: потрібно два докази схеми
  const proofs = [r.R8 === 'a', veisCaught, doroshExposed].filter(Boolean).length;
  const scheme: PaperEpilogue['axes']['scheme'] = c.organizer && proofs >= 2 ? 'exposed' : 'hidden';

  const lines: PaperEpilogue['lines'] = {
    orest: c.remover ? 'hero' : 'shadow',
    dorosh: doroshExposed ? 'exposed' : 'promoted',
    marta: r.R8 === 'a' ? 'deal' : r.R8 === 'b' ? 'charged' : 'free',
  };

  const review: string[] = [];
  if (killer !== 'convicted') {
    if (!r.solved.Z5) review.push('missShadow');
    if (!r.solved.Z6) review.push('missLedger');
    if (!(r.R5 === 'a' || r.R5 === 'b')) review.push('missWitness');
  }
  if (leak) review.push('leak');
  if (killer === 'escaped' && killerPlace === 'station') review.push('alert');
  if (detained) review.push('korzh');
  if (killer === 'escaped') review.push('wrongPlace');
  if (scheme === 'hidden') review.push(!c.organizer ? 'schemeName' : 'schemeProof2');
  if (stepan === 'dead') review.push('stepanDead');

  const parts = {
    killer: KILLER_POINTS[killer],
    astrolabe: ASTROLABE_POINTS[astrolabe],
    stepan: STEPAN_POINTS[stepan],
    korzh: KORZH_POINTS[korzh],
    scheme: scheme === 'exposed' ? 15 : 0,
    orest: lines.orest === 'hero' ? 5 : 0,
    time: Math.max(0, Math.round(durationMin - (r.finishMin + r.hints * hintPenaltyMin + r.gatePenaltyMin))),
    hints: -3 * r.hints,
  };
  return { killerPlace, veis, evidence, axes: { killer, astrolabe, stepan, korzh, scheme }, lines, review, score: { ...parts, total: Object.values(parts).reduce((a, b) => a + b, 0) } };
}
