import { beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildCase } from '../../../tools/build-content.ts';
import type { CaseBundle, Level } from '../../../shared/case-types.ts';
import { TownMap, SquarePlan } from './maps.tsx';
import { mmPerMeter } from './scale.ts';
import { knownComponents, renderDoc } from '../documents/registry.tsx';
import { DocProvider } from '../documents/context.tsx';

let bundle: CaseBundle;
beforeAll(async () => {
  bundle = await buildCase('content/cases/astrolabe');
}, 60_000);

/** Центри маркерів з data-point="…" (cx, cy у мм). */
function markers(svg: string): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const m of svg.matchAll(/<circle[^>]*data-point="([^"]+)"[^>]*>/g)) {
    const cx = Number(m[0].match(/cx="([\d.-]+)"/)![1]);
    const cy = Number(m[0].match(/cy="([\d.-]+)"/)![1]);
    out[m[1]] = { x: cx, y: cy };
  }
  return out;
}
const mm = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const wrap = (el: React.ReactElement, level: Level = 'trainee') => (
  <DocProvider bundle={bundle} level={level} print baseUrl="https://example.org/app/">
    {el}
  </DocProvider>
);

describe('scale', () => {
  it('converts metres to millimetres on paper', () => {
    expect(mmPerMeter(10_000)).toBe(0.1);
    expect(mmPerMeter(1_000)).toBe(1);
  });
});

describe('TownMap', () => {
  it('places the stage 45 mm from the tower at 1:10 000', () => {
    const svg = renderToStaticMarkup(wrap(<TownMap />));
    const p = markers(svg);
    expect(mm(p.tower, p.stage)).toBeCloseTo(45.0, 0);
    expect(Math.abs(mm(p.tower, p.stage) - 45)).toBeLessThanOrEqual(0.3);
  });

  it('draws a 500 m scale bar 50 mm long', () => {
    const svg = renderToStaticMarkup(wrap(<TownMap />));
    const bar = svg.match(/data-scalebar="(\d+)"[^>]*\swidth="([\d.]+)"/)!;
    expect(Number(bar[1])).toBe(500);
    expect(Number(bar[2])).toBeCloseTo(50, 3);
  });

  it('prints latitude and park hours', () => {
    const svg = renderToStaticMarkup(wrap(<TownMap />));
    expect(svg).toContain('49°25′');
    expect(svg).toContain('07:00–24:00');
  });
});

describe('SquarePlan', () => {
  it('places the museum door 60 mm from the tower at 1:1 000', () => {
    const p = markers(renderToStaticMarkup(wrap(<SquarePlan />)));
    expect(Math.abs(mm(p.tower, p.museumDoor) - 60)).toBeLessThanOrEqual(0.3);
    expect(Math.abs(mm(p.museumDoor, p.chapel) - 120)).toBeLessThanOrEqual(0.3);
  });

  it('has a compass', () => {
    expect(renderToStaticMarkup(wrap(<SquarePlan />))).toContain('data-compass');
  });
});

describe('renderDoc', () => {
  it('renders every document on both levels without missing texts', () => {
    for (const level of ['trainee', 'detective'] as Level[]) {
      for (const doc of bundle.docs) {
        expect(knownComponents, `${doc.id}: компонент ${doc.component}`).toContain(doc.component);
        const html = renderToStaticMarkup(wrap(renderDoc(doc), level));
        expect(html.length, doc.id).toBeGreaterThan(20);
        expect(html, `${doc.id}: незнайдений текст`).not.toContain('⟨');
        expect(html, `${doc.id}: QR без коду`).not.toContain('code/NaN');
      }
    }
  });

  it('shows the trainee-only fall time only to trainees', () => {
    const doc = bundle.docs.find((d) => d.id === '1-05')!;
    expect(renderToStaticMarkup(wrap(renderDoc(doc), 'trainee'))).toContain('2,0 с');
    expect(renderToStaticMarkup(wrap(renderDoc(doc), 'detective'))).not.toContain('2,0 с');
  });
});

describe('act 2 documents', () => {
  it('hides the third digit of the year on the inventory card', () => {
    const doc = bundle.docs.find((d) => d.id === '2-02')!;
    const html = renderToStaticMarkup(wrap(renderDoc(doc)));
    expect(html).not.toContain('1647');
    expect(html).toContain('coffee-stain');
  });

  it('blurs the insured sum only for detectives', () => {
    const doc = bundle.docs.find((d) => d.id === '2-09')!;
    expect(renderToStaticMarkup(wrap(renderDoc(doc), 'trainee'))).toContain('49 720');
    expect(renderToStaticMarkup(wrap(renderDoc(doc), 'detective'))).not.toContain('49 720');
  });

  it('puts the decision code on the fingerprint report and the fund clipping', () => {
    for (const [id, code] of [['2-12', 212], ['2-14', 214]] as const) {
      const html = renderToStaticMarkup(wrap(renderDoc(bundle.docs.find((d) => d.id === id)!)));
      expect(html, id).toContain(`#/code/${code}`);
    }
  });
});

describe('act 3 documents', () => {
  const html = (id: string, level: Level = 'trainee') => renderToStaticMarkup(wrap(renderDoc(bundle.docs.find((d) => d.id === id)!), level));

  it('prints the solver sun table on task sheet 3 for each level', () => {
    expect(html('3-11', 'trainee')).toContain('2,44');
    expect(html('3-11', 'detective')).toContain('22,3');
    expect(html('3-11', 'detective')).not.toContain('2,44');
  });

  it('gives the weight rates only to trainees', () => {
    expect(html('3-01', 'trainee')).toContain('12 см за годину');
    expect(html('3-01', 'detective')).not.toContain('12 см за годину');
    expect(html('3-01', 'detective')).toContain('Л. Барвінок');
  });

  it('shows the expert notes and the task code on Timur photo', () => {
    expect(html('3-05')).toContain('28-й плитці');
    expect(html('3-05')).toContain('#/code/305');
  });

  it('labels the code on Iryna card', () => {
    expect(html('3-13')).toContain('Поговорити з Іриною');
  });
});

describe('act 4 documents', () => {
  const html = (id: string, level: Level = 'trainee') => renderToStaticMarkup(wrap(renderDoc(bundle.docs.find((d) => d.id === id)!), level));

  it('shows the struck-out real mass on the draft act', () => {
    expect(html('4-04')).toMatch(/<s[^>]*>2 628<\/s>/);
    expect(html('4-04')).toContain('2 840');
  });

  it('prints the level cipher on the notebook page, with the progression rule only for detectives', () => {
    expect(html('4-09', 'trainee')).toContain('ОТФМ ХМ');
    expect(html('4-09', 'detective')).toContain('ОЧС ТПУҐУЬ');
    expect(html('4-09', 'trainee')).not.toContain('на крок далі');
    expect(html('4-09', 'detective')).toContain('на крок далі');
  });

  it('never prints the trainee safe code', () => {
    for (const d of bundle.docs.filter((x) => x.medium === 'paper')) expect(html(d.id), d.id).not.toContain('1647');
  });
});
