// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { buildCase } from '../../../tools/build-content.ts';
import type { CaseBundle } from '../../../shared/case-types.ts';
import App from './App.tsx';
import { encodeGame, toSyncData } from '../engine/sync.ts';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

let bundle: CaseBundle;
beforeAll(async () => {
  bundle = await buildCase('content/cases/astrolabe');
}, 60_000);

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
});
afterEach(cleanup);

const KEY = 'astrolabe:v2';
type Saved = { games: { id: string; team: string; [k: string]: unknown }[]; active: string };
const board = (): Saved => JSON.parse(localStorage.getItem(KEY)!);
const activeGame = () => {
  const b = board();
  return b.games.find((g) => g.id === b.active)! as Record<string, any>;
};
/** Інша вкладка змінила активну гру. */
function patchActive(fn: (g: Record<string, any>) => void) {
  const b = board();
  fn(b.games.find((g) => g.id === b.active)!);
  localStorage.setItem(KEY, JSON.stringify(b));
  window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
}

async function startGame(team = 'Сови') {
  fireEvent.change(await screen.findByLabelText('Назва команди'), { target: { value: team } });
  fireEvent.click(screen.getByRole('button', { name: 'Почати розслідування' }));
}

describe('App', () => {
  it('offers to start when a code is opened before the game (code before start)', async () => {
    window.location.hash = '#/code/114';
    render(<App bundle={bundle} />);
    expect(await screen.findByText('Почати розслідування?')).toBeTruthy();
    await startGame();
    // Допит до рішення Р1 запускає дзвінок начальника.
    await waitFor(() => expect(window.location.hash).toBe('#/decision/R1'));
    expect(await screen.findByText(/Що відповісти начальнику відділу/)).toBeTruthy();
  });

  it('normalizes typed codes (code entry normalizes)', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    window.location.hash = '#/enter';
    fireEvent.change(await screen.findByLabelText('Код документа'), { target: { value: 'ас 190' } });
    fireEvent.click(screen.getByRole('button', { name: 'Відкрити' }));
    await waitFor(() => expect(window.location.hash).toBe('#/task/Z1'));
    expect(await screen.findByText(/горизонтальною швидкістю/)).toBeTruthy();
  });

  it('rejects unknown codes without changing state (unknown code)', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    const before = activeGame();
    window.location.hash = '#/enter';
    fireEvent.change(await screen.findByLabelText('Код документа'), { target: { value: 'АС-999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Відкрити' }));
    expect(await screen.findByText('Такого коду в справі немає')).toBeTruthy();
    expect(activeGame().unlocked).toEqual(before.unlocked);
  });

  it('opens envelope A after the right answer (gate A flow)', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    window.location.hash = '#/task/Z1';
    fireEvent.change(await screen.findByLabelText('Ваша відповідь'), { target: { value: '1,8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Перевірити' }));
    await waitFor(() => expect(window.location.hash).toBe('#/envelope/A'), { timeout: 5000 });
    expect(await screen.findByRole('heading', { name: 'Відкрийте конверт А' })).toBeTruthy();
  });

  it('says so when an answer is wrong', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    window.location.hash = '#/task/Z1';
    fireEvent.change(await screen.findByLabelText('Ваша відповідь'), { target: { value: '0,6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Перевірити' }));
    expect(await screen.findByText('Не сходиться. Перевірте розрахунок.')).toBeTruthy();
  });
});

describe('envelope labels', () => {
  it('shows Ukrainian letters for envelopes, not the internal Latin ids', async () => {
    const { envelopeLabel, ui } = await import('./strings.ts');
    expect(['A', 'B', 'C', 'D'].map(envelopeLabel)).toEqual(['А', 'Б', 'В', 'Г']);
    expect(ui.envelopeOpen('C')).toBe('Відкрийте конверт В');
  });
});

describe('several tabs', () => {
  it('adopts progress written by another tab', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    patchActive((other) => {
      other.decisions = { R1: 'a' };
      other.interviewsDone = ['korzh'];
    });
    window.location.hash = '#/interview/korzh';
    expect(await screen.findByText(/Протокол допиту свідка/)).toBeTruthy();
  });
});

describe('act 2 screens', () => {
  async function passGateA() {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    window.location.hash = '#/task/Z1';
    fireEvent.change(await screen.findByLabelText('Ваша відповідь'), { target: { value: '1,8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Перевірити' }));
    await waitFor(() => expect(window.location.hash).toBe('#/envelope/A'), { timeout: 5000 });
  }

  it('a document code opens the decision it asks for', async () => {
    await passGateA();
    window.location.hash = '#/code/212';
    await waitFor(() => expect(window.location.hash).toBe('#/decision/R3'));
    expect(await screen.findByText('Що робити з реставратором Коржем?')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Залучити Коржа як консультанта' })).toBeNull();
  });

  it('offers to release Korzh after detaining him', async () => {
    await passGateA();
    window.location.hash = '#/code/212';
    fireEvent.click(await screen.findByRole('button', { name: 'Затримати Коржа' }));
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }));
    window.location.hash = '#/case';
    fireEvent.click(await screen.findByRole('link', { name: /Звільнити Давида Коржа/ }));
    expect(await screen.findByRole('button', { name: 'Звільнити Коржа' })).toBeTruthy();
  });

  it('keeps the police database closed until envelope A', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    expect(screen.queryByRole('link', { name: 'База' })).toBeNull();
    window.location.hash = '#/db';
    expect(await screen.findByText('База даних поліції відкриється разом із конвертом А.')).toBeTruthy();
  });

  it('searches the police database by exact query', async () => {
    await passGateA();
    window.location.hash = '#/db';
    fireEvent.change(await screen.findByLabelText('Запит до бази'), { target: { value: 'ВХ 4717 АК' } });
    fireEvent.click(screen.getByRole('button', { name: 'Шукати' }));
    expect(await screen.findByText(/Škoda Fabia/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Запит до бази'), { target: { value: 'ВХ 47?7 А?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Шукати' }));
    expect(await screen.findByText('Нічого не знайдено. База шукає лише точний збіг.')).toBeTruthy();
  });
});

describe('finale screens', () => {
  it('accuses and shows the epilogue newspaper', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    patchActive((s) => {
      s.flags = { ...s.flags, op1: 'home', op_done: true, op2: 'station' };
      s.solved = { Z5: { canon: 'x', at: s.startedAt }, Z9: { canon: 'x', at: s.startedAt } };
    });
    window.location.hash = '#/accuse';
    fireEvent.change(await screen.findByLabelText('Хто вбив Ореста Гайового?'), { target: { value: 'prokopchuk' } });
    fireEvent.change(screen.getByLabelText('Хто зняв оригінал астролябії з вітрини?'), { target: { value: 'hayovyi' } });
    fireEvent.change(screen.getByLabelText('Де оригінал зараз?'), { target: { value: 'tower' } });
    fireEvent.change(screen.getByLabelText('Хто організував схему вивезення астролябії?'), { target: { value: 'bayda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Висунути звинувачення' }));
    await waitFor(() => expect(window.location.hash).toBe('#/epilogue'));
    expect(await screen.findByRole('heading', { name: 'Убивцю зберігача засуджено' })).toBeTruthy();
    expect(screen.getByText(/Залу астрономії назвали його іменем/)).toBeTruthy();
  });

  it('keeps the accusation closed until the operation and the second group', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    patchActive((s) => {
      s.flags = { ...s.flags, op1: 'home', op_done: true };
    });
    window.location.hash = '#/accuse';
    expect(await screen.findByText(/Звинувачення — коли групи займуть позиції/)).toBeTruthy();
  });
});

describe('several teams on one screen', () => {
  it('adds a second team and switches between them', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame('Сови');
    window.location.hash = '#/';
    fireEvent.click(await screen.findByRole('button', { name: 'Додати команду' }));
    await startGame('Лиси');
    const picker = (await screen.findByLabelText('Команда')) as HTMLSelectElement;
    expect([...picker.options].map((o) => o.text)).toEqual(['Сови', 'Лиси']);
    expect(activeGame().team).toBe('Лиси');
    fireEvent.change(picker, { target: { value: board().games[0].id } });
    await waitFor(() => expect(activeGame().team).toBe('Сови'));
  });

  it('ends only the current team’s game', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame('Сови');
    window.location.hash = '#/';
    fireEvent.click(await screen.findByRole('button', { name: 'Додати команду' }));
    await startGame('Лиси');
    window.location.hash = '#/';
    fireEvent.click(await screen.findByRole('button', { name: 'Почати заново' }));
    fireEvent.click(screen.getByRole('button', { name: 'Так' }));
    await waitFor(() => expect(board().games.map((g) => g.team)).toEqual(['Сови']));
    expect(activeGame().team).toBe('Сови');
    // підтвердження не лишається «зведеним» для наступної команди
    expect(screen.queryByRole('button', { name: 'Так' })).toBeNull();
  });
});

describe('one team, several phones', () => {
  async function shareLink(): Promise<string> {
    window.location.hash = '#/team';
    const qr = await screen.findByRole('img', { name: 'QR для інших телефонів команди' });
    await waitFor(() => expect(qr.getAttribute('data-qr')).toContain('#/join/'));
    return qr.getAttribute('data-qr')!.split('#')[1];
  }

  it('a second phone joins the team from the shared link', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame('Сови');
    const id = activeGame().id;
    const link = await shareLink();
    cleanup();
    localStorage.clear();
    window.location.hash = `#${link}`;
    render(<App bundle={bundle} />);
    await waitFor(() => expect(window.location.hash).toBe('#/case'));
    expect(board().games.map((g) => [g.team, g.id])).toEqual([['Сови', id]]);
  });

  it('merges into the same team instead of adding another', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame('Сови');
    const link = await shareLink();
    window.location.hash = `#${link}`;
    await waitFor(() => expect(window.location.hash).toBe('#/case'));
    expect(board().games).toHaveLength(1);
  });

  it('asks before replacing another team’s game', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame('Сови');
    const link = await shareLink();
    cleanup();
    localStorage.clear();
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame('Лиси');
    window.location.hash = `#${link}`;
    fireEvent.click(await screen.findByRole('button', { name: 'Замінити гру «Лиси»' }));
    await waitFor(() => expect(board().games.map((g) => g.team)).toEqual(['Сови']));
    expect(screen.queryByRole('button', { name: 'Додати як ще одну команду' })).toBeNull();
  });

  it('adds a team whose id clashes with another game as a separate team', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame('Сови');
    const code = await encodeGame({ ...toSyncData(activeGame() as never), level: 'detective', team: 'Лиси' });
    window.location.hash = `#/join/${code}`;
    fireEvent.click(await screen.findByRole('button', { name: 'Додати як ще одну команду' }));
    await waitFor(() => expect(board().games.map((g) => g.team).sort()).toEqual(['Лиси', 'Сови']));
    expect(new Set(board().games.map((g) => g.id)).size).toBe(2);
  });

  it('says so when the link is broken', async () => {
    window.location.hash = '#/join/broken';
    render(<App bundle={bundle} />);
    expect(await screen.findByText('Посилання пошкоджене або від іншої справи.')).toBeTruthy();
  });
});

describe('the 60-minute game', () => {
  it('starts at 25:00 with envelope A open and the skipped tasks optional', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    fireEvent.click(await screen.findByLabelText(/60 хвилин/));
    await startGame();
    expect(await screen.findByText('Відкрийте конверт А')).toBeTruthy();
    // таймер оновлюється щосекунди
    await waitFor(() => expect(screen.getByLabelText('Час розслідування').textContent).toMatch(/^25:/), { timeout: 2500 });
    expect(activeGame()).toMatchObject({ short: true, decisions: { R1: 'a' } });
    expect(screen.getByRole('link', { name: /З-7.*за бажанням/ })).toBeTruthy();
    // З-9 — задача акту 3: з'являється з конвертом Б, а не на старті
    expect(screen.queryByRole('link', { name: /З-9/ })).toBeNull();
  });
});

describe('departments mode', () => {
  async function startDepartments() {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    fireEvent.click(await screen.findByLabelText(/Відділи/));
    await startGame();
  }

  it('marks and filters the archive by department', async () => {
    await startDepartments();
    window.location.hash = '#/archive';
    expect(await screen.findByText('1-09')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Криміналісти' }));
    expect(screen.queryByText('1-09')).toBeNull();
    expect(screen.getByText('Для цього відділу документів поки немає.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Оперативники' }));
    expect(screen.getByText('1-09')).toBeTruthy();
    expect(screen.getAllByTitle('Оперативники').length).toBeGreaterThan(0);
  });

  it('shows which departments a task needs', async () => {
    await startDepartments();
    window.location.hash = '#/task/Z1';
    expect(await screen.findByText('Потрібні висновки: Криміналісти + Оперативники')).toBeTruthy();
  });

  it('decides by vote; the group lead breaks a three-way tie', async () => {
    await startDepartments();
    patchActive((g) => {
      g.pendingDecisions = ['R1'];
    });
    window.location.hash = '#/decision/R1';
    fireEvent.change(await screen.findByLabelText('Голос: Криміналісти'), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText('Голос: Аналітики'), { target: { value: 'b' } });
    fireEvent.change(screen.getByLabelText('Голос: Оперативники'), { target: { value: 'c' } });
    expect(screen.getByText('Нічия — вирішує керівник групи.')).toBeTruthy();
    fireEvent.change(await screen.findByLabelText('Керівник групи'), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }));
    await waitFor(() => expect(activeGame().decisions).toEqual({ R1: 'b' }));
  });

  it('a competition team decides without voting', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    patchActive((g) => {
      g.pendingDecisions = ['R1'];
    });
    window.location.hash = '#/decision/R1';
    await screen.findByText(/Що відповісти начальнику відділу/);
    expect(screen.queryByLabelText('Голос: Криміналісти')).toBeNull();
  });
});

describe('host console', () => {
  const code = (parse(readFileSync('content/cases/astrolabe/case.yaml', 'utf8')) as { host: { code: string } }).host.code;

  it('locks itself when the host leaves it — players on the same screen must not see the solution', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame('Сови');
    window.location.hash = '#/host';
    fireEvent.change(await screen.findByLabelText('Код ведучого'), { target: { value: code } });
    fireEvent.click(screen.getByRole('button', { name: 'Відкрити пульт' }));
    expect(await screen.findByRole('heading', { name: 'Пульт ведучого' })).toBeTruthy();
    window.location.hash = '#/case';
    await screen.findByText(/Упав чи штовхнули/);
    window.location.hash = '#/host';
    expect(await screen.findByLabelText('Код ведучого')).toBeTruthy();
    expect(screen.queryByText('Прокопчук Неля Василівна')).toBeNull();
  });

  it('stays locked without the code, then shows teams, answers and decisions and can open a gate', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame('Сови');
    window.location.hash = '#/host';
    fireEvent.change(await screen.findByLabelText('Код ведучого'), { target: { value: 'хибний' } });
    fireEvent.click(screen.getByRole('button', { name: 'Відкрити пульт' }));
    expect(await screen.findByText('Неправильний код ведучого.')).toBeTruthy();
    expect(screen.queryByText(/1,6–1,9/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Код ведучого'), { target: { value: code } });
    fireEvent.click(screen.getByRole('button', { name: 'Відкрити пульт' }));
    expect(await screen.findByRole('heading', { name: 'Пульт ведучого' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Сови' })).toBeTruthy();
    expect(screen.getByText('1,6–1,9 м/с')).toBeTruthy();
    expect(screen.getAllByText(/Р1/).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Розгадка' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Прокопчук Неля Василівна' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Відкрити шлюз А (+10 хв)' }));
    await waitFor(() => expect(activeGame().gatePayloads.A).toBeDefined());
    expect(activeGame().penaltyMin).toBe(10);
    expect(sessionStorage.getItem('astrolabe:host')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Закрити пульт' }));
    expect(await screen.findByLabelText('Код ведучого')).toBeTruthy();
    expect(screen.queryByText('1,6–1,9 м/с')).toBeNull();
    // команда бачить, що шлюз відкрив ведучий, а не «відповідь»
    window.location.hash = '#/task/Z1';
    expect(await screen.findByText(/розкрито ведучим/)).toBeTruthy();
  });
});

describe('nothing urgent goes unnoticed', () => {
  it('a pending decision shows on every screen, with its deadline', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    patchActive((g) => {
      g.pendingDecisions = ['R1'];
    });
    window.location.hash = '#/archive';
    const link = await screen.findByRole('link', { name: /Потрібне рішення.*Що відповісти начальнику відділу.*до відкриття конверта А/ });
    expect(link.getAttribute('href')).toBe('#/decision/R1');
  });

  it('before a gate, the task says which decisions the investigator will take if the team goes on', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    patchActive((g) => {
      g.pendingDecisions = ['R1'];
    });
    window.location.hash = '#/task/Z1';
    expect(await screen.findByText(/Якщо розкрити шлюз зараз, слідча Крук вирішить сама/)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Що відповісти начальнику відділу/ }).length).toBeGreaterThan(0);
  });

  it('an urgent branch task is flagged on every screen', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    patchActive((g) => {
      g.flags = { ...g.flags, poisoned: true };
    });
    window.location.hash = '#/archive';
    const link = await screen.findByRole('link', { name: /Терміново.*З-10/ });
    expect(link.getAttribute('href')).toBe('#/task/Z10');
  });
});

describe('dashboard reminders', () => {
  it('a decision both pending and available is linked once', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    patchActive((g) => {
      g.pendingDecisions = ['R9'];
      g.firedEvents = [...g.firedEvents, 'E5'];
    });
    window.location.hash = '#/case';
    await screen.findAllByRole('link', { name: /Куди відправити оперативну групу/ });
    expect(document.querySelectorAll('a[href="#/decision/R9"]')).toHaveLength(1);
  });

  it('reminds how many interviews are left and where the codes are, until they are used', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    expect(await screen.findByText(/Допити: 0 з 2.*АС-114/)).toBeTruthy();
    patchActive((g) => {
      g.interviewsDone = ['marta', 'nelya'];
    });
    await waitFor(() => expect(screen.queryByText(/Допити: /)).toBeNull());
  });

  it('shows only the newest envelope to open', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    patchActive((g) => {
      g.gatePayloads = { A: { envelope: 'A', message: 'm', unlock: [] }, B: { envelope: 'B', message: 'm', unlock: [] } };
    });
    expect(await screen.findByRole('link', { name: 'Відкрийте конверт Б' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Відкрийте конверт А' })).toBeNull();
  });
});

describe('every decision comes with its situation', () => {
  it('shows the call that actually raised the decision (Stepan calls by either event)', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    patchActive((g) => {
      g.pendingDecisions = ['R5'];
      g.firedEvents = [...g.firedEvents, 'E3b'];
    });
    window.location.hash = '#/decision/R5';
    expect(await screen.findByText(/Я дещо бачив тієї ночі/)).toBeTruthy();
  });

  it('a decision with no event explains the situation itself', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    patchActive((g) => {
      g.unlocked = [...g.unlocked, 'section:C'];
      g.solved = { ...g.solved, Z6: { canon: 'x', at: g.startedAt } };
    });
    window.location.hash = '#/decision/R8';
    expect(await screen.findByText(/Згурська/, { selector: '.note p, .note span' })).toBeTruthy();
  });
});

describe('the message feed', () => {
  it('marks messages with the game minute, not the wall clock, and opens the whole text', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    patchActive((g) => {
      g.inbox = [{ id: 'm1', messageId: '@e1.message', at: g.startedAt + 8 * 60_000 + 5_000, read: false }];
    });
    window.location.hash = '#/case';
    expect(await screen.findByText('хв 8')).toBeTruthy();
    expect(screen.queryByText(/депутат Байда вже двічі дзвонив/)).toBeNull();
    fireEvent.click(screen.getByText(/Дзвонить начальник відділу/));
    expect(await screen.findByText(/депутат Байда вже двічі дзвонив/)).toBeTruthy();
  });
});

describe('how to play', () => {
  it('the very first screen links to the rules, and they open before any game starts', async () => {
    window.location.hash = '';
    render(<App bundle={bundle} />);
    fireEvent.click(await screen.findByRole('link', { name: /Як грати/ }));
    expect(await screen.findByRole('heading', { name: 'Як грати', level: 1 })).toBeTruthy();
    for (const h of ['Комплект', 'Застосунок', 'Рішення й події', 'Фінал і рахунок']) expect(screen.getByRole('heading', { name: h })).toBeTruthy();
    expect(activeGameOrNull()).toBeNull();
  });

  it('during a game the rules are one tap away from the case screen', async () => {
    window.location.hash = '#/setup';
    render(<App bundle={bundle} />);
    await startGame();
    window.location.hash = '#/case';
    const link = await screen.findByRole('link', { name: /Як грати/ });
    expect(link.getAttribute('href')).toBe('#/rules');
  });
});

function activeGameOrNull() {
  return localStorage.getItem(KEY);
}
