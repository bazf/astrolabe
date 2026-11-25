// Обчислює всі числові відповіді справи «Астролябія» з вихідних параметрів
// і перевіряє, що кожне завдання має єдину правильну відповідь.
// Запуск: npm run solve  (або node tools/solve.mjs [--json])
import assert from 'node:assert/strict';

// ---------- Вихідні параметри світу ----------
export const P = {
  city: { name: 'Старокамінь', lat: 49.42, lon: 26.98, tzHours: 3 },
  date: { y: 2026, m: 9, d: 12 }, // субота, День міста
  g: 9.8,
  fall: {
    galleryAboveThreshold: 18.0, // відмітка підлоги галереї від порогу вежі, м
    southPavementBelowThreshold: 1.6, // південна площа нижча за поріг, м
    tile: 0.4, // плитка 40×40 см (специфікація «Байда-Буд»)
    markTiles: 9, // крейдяна позначка — на 9-й плитці від лінії карнизу
    sergeantDistance: 1.2, // що записав сержант Дорош
    slipMaxSpeed: 0.7, // таблиця експерта: послизнувся/перехилився ≤ 0,7 м/с
    pushMinSpeed: 1.5, // поштовх/розбіг ≥ 1,5 м/с
  },
  trap: {
    runSpeed: 5, // м/с, «максимальна швидкість бігу дорослого» з довідки
    steps: 112,
    stepsPerSecond: 2,
    clockStop: '22:10', // хвилина, яку показують стрілки
    // [хто, де, відстань до дверей вежі (м), час фото/відео]
    // Мітки часу з секундами друкуються для обох рівнів.
    people: [
      ['Корж', 'біля дверей вежі (фото Тимура)', 0, '22:09:30'],
      ['Тимур Савка', 'балкон готелю «Ринок» (другий кадр серії)', 220, '22:10:40'],
      ['Прокопчук', 'сцена на Замковій площі (фотозвіт)', 450, '22:09:10'],
      ['Байда', 'сцена на Замковій площі (фотозвіт)', 450, '22:09:10'],
      ['Згурська', 'ресторан «Під каштанами» (фото)', 530, '22:09:20'],
      ['Ірина Гайова', 'натовп біля сцени (сторіз)', 470, '22:11:02'],
      ['Луговий', 'пульт охорони музею (камера)', 75, '22:10:20'],
      ['Вейс', 'крамниця на Замковій (камера)', 900, '22:08:00'],
    ],
  },
  density: {
    original: { mass: 2840, volume: 316 }, // інвентарна картка, обмір 1998 р.
    vitrine: { mass: 2628, volume: 311 }, // лабораторія поліції 13.09 = паспорт копії 2009 р.
    brass: 8.45,
    gold: 19.3,
    brassRange: [8.4, 8.7],
  },
  clock: {
    windAt: '18:00', // завод після удару 18:00
    journalCheck: { at: '09:30', goingDrop: null, strikeDrop: null }, // 12.09, обчислюється
    goingRate: 0.12, // м/год
    perStrike: 0.015, // м/удар
    morning: { goingDrop: 0.8 }, // 13.09, 07:50, протокол огляду механізму
    hoursShown: '22:10',
  },
  shadow: {
    lampHeight: 4.5,
    tile: 0.4,
    tilesInPhoto: 28,
    tableFrom: '08:00',
    tableTo: '18:30',
    stepMin: 10,
    claimed: '10:00', // Прокопчук: «біля вежі була лише вранці, близько десятої»
  },
  route: {
    walkKmh: 5,
    viaParkKm: 1.3, // відкритий до 24:00
    aroundParkKm: 1.9,
    neighbourDoor: '01:08',
    claimedLeft: '23:40',
    scaleCmPer100m: 1, // 1:10 000
  },
  insurance: { declaredUah: 49720, premiumRate: 0.006, eurRate: 45.2, threshold: 50000, comparableEur: 1150000 },
  ledger: {
    catering: { invoice: 16000, paid: 18400 },
    restoration: { firstMonth: '2024-01', first: 6000, step: 250, lastMonth: '2026-08' },
  },
  thermos: {
    tabletMg: 0.15,
    tabletsMissing: 12,
    thermosL: 0.5,
    leftL: 0.1,
    massKg: 92,
    // умовні ігрові пороги «довідки токсиколога» (вигаданий препарат «Гіпотензил»)
    moderateMgPerKg: 0.008,
    severeMgPerKg: 0.012,
  },
  safe: { worn: [1, 4, 6, 7], trainee: { stainedYear: '16_7' } },
  cipher: {
    alphabet: 'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ',
    trainee: 'ВЕЖА ЗА ПІВДЕННИМ ЦИФЕРБЛАТОМ НІША ПІД МЕХАНІЗМОМ ВІДБОЮ',
    // Без слова «вежа»: «циферблат» має і сонячний годинник, тож місце визначає лише азимут + відстань.
    detective: 'ВІД ДВЕРЕЙ МУЗЕЮ АЗИМУТ СОРОК ШІСТДЕСЯТ МЕТРІВ НІША ЗА ЦИФЕРБЛАТОМ',
  },
  square: {
    // план Ринку 1:1000, метри, x — схід, y — північ, початок у дверях вежі
    tower: [0, 0],
    museumDoorBearingDeg: 40,
    museumDoorDistM: 60,
    distractors: { chapel: [40, 120], well: [70, 60], sundial: [15, 60] }, // [азимут від дверей музею, м]
  },
};

// ---------- Допоміжне ----------
const toMin = (hhmm) => {
  const [h, m, s = 0] = hhmm.split(':').map(Number);
  return h * 60 + m + s / 60;
};
const fmt = (min) => {
  const t = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = Math.floor(t % 60);
  const s = Math.round((t - Math.floor(t)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${s ? ':' + String(s).padStart(2, '0') : ''}`;
};
const r = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const rad = (d) => (d * Math.PI) / 180;
const deg = (x) => (x * 180) / Math.PI;

// ---------- 1. Падіння з галереї (шлюз А) ----------
function fall() {
  const f = P.fall;
  const h = f.galleryAboveThreshold + f.southPavementBelowThreshold;
  const t = Math.sqrt((2 * h) / P.g);
  const d = f.markTiles * f.tile;
  const v = d / t;
  const vSergeant = f.sergeantDistance / t;
  assert.ok(v >= f.pushMinSpeed, 'поштовх має давати швидкість ≥ порогу');
  assert.ok(vSergeant <= f.slipMaxSpeed, 'цифра сержанта має виглядати як нещасний випадок');
  return { h, t: r(t, 3), d, v: r(v, 2), vSergeant: r(vSergeant, 2), verdict: 'поштовх' };
}

// ---------- 2. Пастка «22:10»: хто міг бути на галереї ----------
function trap() {
  const T = P.trap;
  const climb = T.steps / T.stepsPerSecond; // с
  const windowEnd = toMin(T.clockStop) + 59 / 60; // 22:10:59
  const rows = T.people.map(([who, where, dist, at]) => {
    const arrive = toMin(at) + (dist / T.runSpeed + climb) / 60;
    return { who, where, dist, at, earliestOnGallery: fmt(arrive), could: arrive <= windowEnd };
  });
  const could = rows.filter((x) => x.could).map((x) => x.who);
  assert.deepEqual(could, ['Корж'], 'пастка має вказувати лише на Коржа');
  return { climbSec: climb, rows, answer: could };
}

// ---------- 3. Густина (шлюз Б) ----------
function density() {
  const D = P.density;
  const rhoO = D.original.mass / D.original.volume;
  const rhoV = D.vitrine.mass / D.vitrine.volume;
  // частка золота за масою: 1/ρ = w/ρз + (1−w)/ρл
  const w = (1 / D.brass - 1 / rhoO) / (1 / D.brass - 1 / D.gold);
  const wV = (1 / D.brass - 1 / rhoV) / (1 / D.brass - 1 / D.gold);
  const goldG = w * D.original.mass;
  assert.ok(rhoV >= D.brassRange[0] && rhoV <= D.brassRange[1], 'вітринний предмет — звичайна латунь');
  assert.ok(rhoO > D.brassRange[1], 'оригінал важчий за латунь');
  return {
    rhoOriginal: r(rhoO, 2),
    rhoVitrine: r(rhoV, 2),
    goldShareOriginal: r(w * 100, 1),
    goldShareVitrine: r(Math.max(0, wV) * 100, 1),
    goldGramsMissing: Math.round(goldG),
    traineeAnswer: r(rhoV, 2),
  };
}

// ---------- 4. Гирі годинника (шлюз В) ----------
function strikesBetween(fromMin, toMinIncl) {
  // fromMin — виключно, toMinIncl — включно; щогодини б’є кількість годин (12-год.), о пів — 1 удар
  let n = 0;
  for (let t = Math.floor(fromMin) + 1; t <= toMinIncl; t++) {
    const mm = ((t % 1440) + 1440) % 1440;
    if (mm % 60 === 0) {
      const h12 = (mm / 60) % 12 || 12;
      n += h12;
    } else if (mm % 60 === 30) n += 1;
  }
  return n;
}
function clock() {
  const C = P.clock;
  const wind = toMin(C.windAt);
  // журнал: 11.09 18:00 завів → 12.09 09:30 перевірка
  const check = toMin(C.journalCheck.at) + 1440;
  const hoursToCheck = (check - wind) / 60;
  const goingAtCheck = r(C.goingRate * hoursToCheck, 2);
  const strikesToCheck = strikesBetween(wind, check);
  const strikeAtCheck = r(strikesToCheck * C.perStrike, 3);
  // ранок 13.09
  const hoursRun = C.morning.goingDrop / C.goingRate;
  const stop = wind + hoursRun * 60;
  const strikesToStop = strikesBetween(wind, stop);
  const strikeDropMorning = r(strikesToStop * C.perStrike, 3);
  // що було б, якби годинник справді став у показаний час (22:10)
  const fake = toMin(C.hoursShown);
  const strikesFake = strikesBetween(wind, fake);
  const goingFake = r(((fake - wind) / 60) * C.goingRate, 3);
  // перевірка: удари однозначно вказують на проміжок після 00:30 і до 01:00
  assert.equal(strikesBetween(wind, toMin('00:30') + 1440), strikesToStop);
  assert.ok(strikesBetween(wind, toMin('01:00') + 1440) > strikesToStop);
  return {
    journal: { hoursToCheck, goingAtCheck, strikesToCheck, strikeAtCheck },
    morning: { goingDrop: C.morning.goingDrop, strikeDrop: strikeDropMorning, strikes: strikesToStop },
    realStop: fmt(stop),
    ifStoppedAtShown: { goingDrop: goingFake, strikes: strikesFake, strikeDrop: r(strikesFake * C.perStrike, 3) },
  };
}

// ---------- 5. Тінь ліхтаря на фото Тимура ----------
function sunAltitude(localMin) {
  const { lat, lon, tzHours } = P.city;
  const { y, m, d } = P.date;
  const N = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 864e5) + 1;
  const utcH = localMin / 60 - tzHours;
  const gam = ((2 * Math.PI) / 365) * (N - 1 + (utcH - 12) / 24);
  const eqt =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(gam) - 0.032077 * Math.sin(gam) - 0.014615 * Math.cos(2 * gam) - 0.040849 * Math.sin(2 * gam));
  const decl =
    0.006918 - 0.399912 * Math.cos(gam) + 0.070257 * Math.sin(gam) - 0.006758 * Math.cos(2 * gam) +
    0.000907 * Math.sin(2 * gam) - 0.002697 * Math.cos(3 * gam) + 0.00148 * Math.sin(3 * gam);
  const tst = localMin + eqt + 4 * lon - 60 * tzHours;
  const ha = rad(tst / 4 - 180);
  const phi = rad(lat);
  const cosZ = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  return 90 - deg(Math.acos(cosZ));
}
function shadow() {
  const S = P.shadow;
  const s = S.tilesInPhoto * S.tile;
  const altPhoto = deg(Math.atan(S.lampHeight / s));
  const table = [];
  for (let t = toMin(S.tableFrom); t <= toMin(S.tableTo); t += S.stepMin) {
    const a = sunAltitude(t);
    table.push({ time: fmt(t), altitudeDeg: r(a, 1), shadowToHeight: r(1 / Math.tan(rad(a)), 2) });
  }
  // точний час, коли тінь = s (сонце опускається після полудня — монотонно)
  let lo = toMin('14:00'), hi = toMin('19:00');
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (sunAltitude(mid) > altPhoto) lo = mid; else hi = mid;
  }
  const exact = (lo + hi) / 2;
  // Та сама висота Сонця буває двічі: вранці і після полудня. Розрізняє напрямок тіні (план Ринку має компас).
  const noon = solarNoon();
  const am = table.filter((x) => toMin(x.time) < noon);
  const pm = table.filter((x) => toMin(x.time) > noon);
  const near = (rows, key, v) => rows.reduce((b, x) => (Math.abs(x[key] - v) < Math.abs(b[key] - v) ? x : b));
  const ratio = s / S.lampHeight;
  const nearest = near(pm, 'altitudeDeg', altPhoto);
  const nearestRatio = near(pm, 'shadowToHeight', ratio);
  const morningTwin = near(am, 'altitudeDeg', altPhoto);
  assert.equal(nearest.time, nearestRatio.time, 'обидва рівні мають давати той самий рядок таблиці');
  const claimedRow = table.find((x) => x.time === S.claimed);
  assert.ok(Math.abs(claimedRow.shadowToHeight - ratio) > 0.5, 'заявлений Нелею час має давати зовсім іншу тінь');
  return {
    shadowM: r(s, 2),
    ratio: r(ratio, 2),
    altitudeDeg: r(altPhoto, 1),
    exactTime: fmt(exact),
    answer: nearest.time,
    morningTwin: morningTwin.time,
    claimed: { time: S.claimed, ratio: claimedRow.shadowToHeight, altitudeDeg: claimedRow.altitudeDeg },
    noon: fmt(noon),
    table,
  };
}
function solarNoon() {
  let best = 0, bt = 0;
  for (let t = 600; t < 900; t += 0.5) { const a = sunAltitude(t); if (a > best) { best = a; bt = t; } }
  return bt;
}

// ---------- 6. Маршрут Прокопчук додому ----------
function route() {
  const R = P.route;
  const tPark = (R.viaParkKm / R.walkKmh) * 60;
  const tAround = (R.aroundParkKm / R.walkKmh) * 60;
  const claimedArrive = toMin(R.claimedLeft) + tPark;
  const leftIfDoor = toMin(R.neighbourDoor) + 1440 - tAround;
  return {
    viaParkMin: r(tPark, 1),
    aroundParkMin: r(tAround, 1),
    claimedArrival: fmt(claimedArrive),
    leftCentreAt: fmt(leftIfDoor),
    traineeAnswerMin: Math.round(tAround),
  };
}

// ---------- 7. Страхування ----------
function insurance() {
  const I = P.insurance;
  const premium = r(I.declaredUah * I.premiumRate, 2);
  const declaredEur = I.declaredUah / I.eurRate;
  const times = I.comparableEur / declaredEur;
  const understatedPct = (1 - declaredEur / I.comparableEur) * 100;
  assert.ok(I.declaredUah < I.threshold);
  return { premium, declaredEur: r(declaredEur, 0), times: Math.round(times), understatedPct: r(understatedPct, 1) };
}

// ---------- 8. Касова книга ----------
function monthsBetween(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma) + 1;
}
function ledger() {
  const L = P.ledger;
  const markup = ((L.catering.paid - L.catering.invoice) / L.catering.invoice) * 100;
  const R = L.restoration;
  const n = monthsBetween(R.firstMonth, R.lastMonth);
  const last = R.first + (n - 1) * R.step;
  const total = (n * (R.first + last)) / 2;
  const n2026Start = monthsBetween(R.firstMonth, '2026-01');
  const jan2026 = R.first + (n2026Start - 1) * R.step;
  const total2026 = (8 * (jan2026 + last)) / 2;
  return { cateringMarkupPct: r(markup, 1), kickback: L.catering.paid - L.catering.invoice, months: n, jan2026, aug2026: last, total2026, totalAll: total };
}

// ---------- 9. Термос (лише в гілці отруєння) ----------
function thermos() {
  const T = P.thermos;
  const mg = T.tabletMg * T.tabletsMissing;
  const c = mg / T.thermosL;
  const drunk = c * (T.thermosL - T.leftL);
  const perKg = drunk / T.massKg;
  const cat = perKg >= T.severeMgPerKg ? 'тяжке' : perKg >= T.moderateMgPerKg ? 'середнє' : 'легке';
  return { totalMg: r(mg, 2), mgPerL: r(c, 2), drunkMg: r(drunk, 2), mgPerKg: r(perKg, 4), category: cat };
}

// ---------- 10. Сейф Ореста ----------
const permutations = (arr) => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p])));
function safe() {
  const S = P.safe;
  // Стажер: 4 цифри, рік; на інвентарній картці пляма «16_7»
  const years = permutations(S.worn).map((p) => p.join('')).filter((s) => /^16.7$/.test(s));
  assert.equal(years.length, 1);
  // Слідчий: 6 цифр ДДММРР, кожна стерта кнопка вжита хоча б раз, інших цифр нема
  const digits = S.worn.map(String);
  const cands = [];
  for (let dd = 1; dd <= 31; dd++)
    for (let mm = 1; mm <= 12; mm++)
      for (let yy = 0; yy <= 99; yy++) {
        const s = String(dd).padStart(2, '0') + String(mm).padStart(2, '0') + String(yy).padStart(2, '0');
        if (![...s].every((c) => digits.includes(c))) continue;
        if (!digits.every((c) => s.includes(c))) continue;
        const year = yy <= 26 ? 2000 + yy : 1900 + yy;
        const dt = new Date(Date.UTC(year, mm - 1, dd));
        if (dt.getUTCMonth() !== mm - 1) continue;
        if (year > 2026 || year < 1940) continue;
        cands.push({ code: s, date: `${String(dd).padStart(2, '0')}.${String(mm).padStart(2, '0')}.${year}`, weekday: dt.getUTCDay() });
      }
  const names = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота'];
  const byDay = {};
  for (const c of cands) (byDay[names[c.weekday]] ||= []).push(c.date);
  const unique = Object.entries(byDay).filter(([, v]) => v.length === 1);
  return { trainee: years[0], traineeCandidates: permutations(S.worn).length, detectiveCandidates: cands.map((c) => `${c.date} (${names[c.weekday]})`), uniqueWeekdays: unique };
}

// ---------- 11. Шифр записника ----------
function shiftText(text, shiftFor) {
  const A = P.cipher.alphabet;
  let w = 0;
  return text
    .split(' ')
    .map((word) => {
      const k = shiftFor(w++);
      return [...word].map((ch) => { const i = A.indexOf(ch); return i < 0 ? ch : A[(i + k) % A.length]; }).join('');
    })
    .join(' ');
}
function cipher() {
  const A = P.cipher.alphabet;
  assert.equal([...A].length, 33);
  const polaris = Math.round(P.city.lat); // висота Полярної ≈ широта
  const base = polaris % 33;
  const trainee = shiftText(P.cipher.trainee, () => base);
  const detective = shiftText(P.cipher.detective, (i) => base + i);
  // зворотна перевірка
  assert.equal(shiftText(trainee, () => 33 - base), P.cipher.trainee);
  return { polaris, shift: base, trainee, detective };
}

// ---------- 12. План Ринку: що лежить на азимуті 40°, 60 м ----------
function square() {
  const S = P.square;
  const b = rad(S.museumDoorBearingDeg);
  const door = [-S.museumDoorDistM * Math.sin(b), -S.museumDoorDistM * Math.cos(b)];
  const pts = { tower: S.tower };
  for (const [k, [az, dist]] of Object.entries(S.distractors)) pts[k] = [door[0] + dist * Math.sin(rad(az)), door[1] + dist * Math.cos(rad(az))];
  return { museumDoor: door.map((x) => r(x, 1)), points: Object.fromEntries(Object.entries(pts).map(([k, v]) => [k, v.map((x) => r(x, 1))])) };
}

export function solveAll() {
  return { fall: fall(), trap: trap(), density: density(), clock: clock(), shadow: shadow(), route: route(), insurance: insurance(), ledger: ledger(), thermos: thermos(), safe: safe(), cipher: cipher(), square: square() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = solveAll();
  console.log(process.argv.includes('--json') ? JSON.stringify(out, null, 2) : JSON.stringify(out, null, 1));
}
