// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { buildCase } from '../../../tools/build-content.ts';
import type { CaseBundle } from '../../../shared/case-types.ts';
import { HostGuide } from './HostGuide.tsx';
import { RulesGuide } from './RulesGuide.tsx';
import { deptSheets, envelopeSheets, planSheets, ranges } from './layout.ts';

let bundle: CaseBundle;
beforeAll(async () => {
  bundle = await buildCase('content/cases/astrolabe');
}, 60_000);
afterEach(cleanup);

const code = (parse(readFileSync('content/cases/astrolabe/case.yaml', 'utf8')) as { host: { code: string } }).host.code;

describe('host guide: what goes where', () => {
  it('writes sheet numbers as ranges', () => {
    expect(ranges([1, 2, 3, 5, 7, 8])).toBe('1–3, 5, 7–8');
    expect(ranges([24])).toBe('24');
  });

  it('lists the folder and every envelope with its sheets, in order', () => {
    const env = envelopeSheets(planSheets(bundle.docs));
    expect(env.map((e) => [e.id, ranges(e.sheets)])).toEqual([
      ['folder', '1–3'],
      ['start', '4–12'],
      ['A', '13–16'],
      ['B', '17–20'],
      ['C', '21–23'],
      ['D', '24'],
    ]);
  });

  it('gives each department exactly its marked paper documents', () => {
    const byDept = deptSheets(planSheets(bundle.docs));
    const marked = bundle.docs.filter((d) => d.medium === 'paper' && d.dept);
    expect(Object.values(byDept).flat()).toHaveLength(marked.length);
    for (const d of marked) expect(byDept[d.dept!].some((x) => x.doc.id === d.id && x.sheet === d.sheet), d.id).toBe(true);
  });
});

describe('host guide page', () => {
  it('without the right code shows nothing of the solution', async () => {
    render(<HostGuide bundle={bundle} code="хибний" baseUrl="https://example.org/astrolabe/" />);
    expect(await screen.findByText(/Неправильний код ведучого/)).toBeTruthy();
    expect(screen.queryByText(/1,6–1,9/)).toBeNull();
  });

  it('with the code prints the code, the envelopes, the answers and the solution', async () => {
    render(<HostGuide bundle={bundle} code={code} baseUrl="https://example.org/astrolabe/" />);
    expect(await screen.findByRole('heading', { name: /Посібник ведучого/ })).toBeTruthy();
    expect(screen.getByText(code)).toBeTruthy();
    expect(screen.getAllByText('1,6–1,9 м/с').length).toBeGreaterThan(0);
    expect(screen.getByRole('row', { name: /Конверт А.*13–16/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Розгадка' })).toBeTruthy();
    expect(screen.getAllByText('Прокопчук Неля Василівна').length).toBeGreaterThan(0);
    expect(document.querySelector('svg.qr[data-qr="https://example.org/astrolabe/#/host"]')).not.toBeNull();
  });
});

describe('rules page for print', () => {
  it('prints every section and a QR to the app — no code needed', () => {
    render(<RulesGuide bundle={bundle} baseUrl="https://example.org/astrolabe/" />);
    expect(screen.getByRole('heading', { name: /Як грати/, level: 1 })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBe(bundle.rules!.sections.length);
    expect(document.querySelector('svg.qr[data-qr="https://example.org/astrolabe/#/code/0"]')).not.toBeNull();
    expect(document.querySelector('.guide[data-ready="1"]')).not.toBeNull();
  });
});
