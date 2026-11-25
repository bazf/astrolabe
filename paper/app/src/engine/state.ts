import type { GatePayload, Level, Mode } from '../../../shared/case-types.ts';

export type InboxItem = { id: string; at: number; read: boolean } & ({ messageId: string; text?: never } | { text: string; messageId?: never });

/** Дії гравця, з яких гру можна відтворити на іншому пристрої (без часу й без запечатаних даних). */
export type LoggedAction =
  | { type: 'decide'; decision: string; option: string }
  /** `trigger` — допит лише викликав подію (дзвінок начальника), сам допит не відбувся */
  | { type: 'interview'; id: string; trigger?: true }
  /** `n` — номер підказки до цього завдання: та сама підказка з двох телефонів рахується раз */
  | { type: 'hint'; task: string; n: number }
  | { type: 'solved'; task: string; canon: string }
  | { type: 'code'; code: number }
  | { type: 'accuse'; answers: Record<string, string>; correct: Record<string, boolean> }
  | { type: 'penalty'; min: number; reason: string };
export type LogEntry = { at: number; a: LoggedAction };

export type GameState = {
  version: 1;
  caseId: string;
  /** спільний для всіх телефонів однієї команди */
  id: string;
  level: Level;
  mode: Mode;
  team: string;
  startedAt: number;
  penaltyMin: number;
  flags: Record<string, unknown>;
  decisions: Record<string, string>;
  pendingDecisions: string[];
  interviewsDone: string[];
  interviewQuota: number;
  solved: Record<string, { canon: string; at: number }>;
  hintsUsed: Record<string, number>;
  /** невдалі спроби: після кожної третьої — пауза */
  wrong: Record<string, { count: number; lockedUntil: number }>;
  firedEvents: string[];
  scheduled: { event: string; dueAt: number }[];
  /** id документів і «section:X» */
  unlocked: string[];
  inbox: InboxItem[];
  gatePayloads: Record<string, GatePayload>;
  /** звинувачення: що обрано і що з цього правильно (обчислюється за хешами під час подання) */
  accusation?: { answers: Record<string, string>; correct: Record<string, boolean>; at: number };
  /** скорочена партія (60 хв): годинник стартує з `short.offsetMin` */
  short?: boolean;
  /** завдання, підказки до яких безкоштовні (скорочена партія) */
  freeHints?: string[];
  /** лише під час відтворення журналу: рішення, які гравці ухвалили самі, — без рішень за замовчуванням */
  reserved?: string[];
  /** журнал дій для синхронізації пристроїв */
  log: LogEntry[];
};

export type Action =
  | { type: 'start'; level: Level; mode: Mode; team: string; now: number; id?: string; short?: boolean }
  | { type: 'decide'; decision: string; option: string; now: number }
  /** `triggerOnly` — відтворення допиту, який лише викликав подію */
  | { type: 'interview'; id: string; now: number; triggerOnly?: boolean }
  | { type: 'hint'; task: string; now: number }
  | { type: 'solved'; task: string; canon: string; payload?: unknown; now: number }
  | { type: 'wrong'; task: string; now: number }
  | { type: 'code'; code: number; now: number }
  | { type: 'accuse'; answers: Record<string, string>; correct: Record<string, boolean>; now: number }
  | { type: 'tick'; now: number }
  /** штраф часу від ведучого (напр., шлюз відкрито за команду) */
  | { type: 'penalty'; min: number; reason: string; now: number }
  | { type: 'read'; inboxId: string }
  | { type: 'reset' };

export const DEFAULT_INTERVIEW_QUOTA = 2;
export const MAX_HINTS = 3;
export const WRONG_PER_LOCK = 3;
export const LOCK_MS = 30_000;
