import type { CaseBundle, CaseDoc, Effect, GateId, GatePayload } from '../../../shared/case-types.ts';
import { dueEvents } from './events.ts';
import { evalCondition } from './conditions.ts';
import { DEFAULT_INTERVIEW_QUOTA, LOCK_MS, MAX_HINTS, WRONG_PER_LOCK, type Action, type GameState, type LoggedAction } from './state.ts';

export const elapsedMin = (s: GameState, now: number) => (now - s.startedAt) / 60_000 + s.penaltyMin;

let inboxSeq = 0;
const inboxId = (now: number) => `${now.toString(36)}-${(inboxSeq++).toString(36)}`;

function applyEffects(s: GameState, effects: Effect[] = [], now: number, silent = false): GameState {
  let n = s;
  for (const e of effects) {
    if ('if' in e) {
      n = applyEffects(n, evalCondition(e.if, n) ? e.then : (e.else ?? []), now, silent);
      continue;
    }
    if (silent && 'message' in e) continue;
    if ('set' in e) {
      n = e.set === 'interviewQuota' ? { ...n, interviewQuota: Number(e.value) } : { ...n, flags: { ...n.flags, [e.set]: e.value } };
    } else if ('penaltyMin' in e) n = { ...n, penaltyMin: n.penaltyMin + e.penaltyMin };
    else if ('unlock' in e) n = n.unlocked.includes(e.unlock) ? n : { ...n, unlocked: [...n.unlocked, e.unlock] };
    else if ('schedule' in e) n = { ...n, scheduled: [...n.scheduled, { event: e.schedule, dueAt: now + e.afterMin * 60_000 }] };
    else if ('message' in e) n = { ...n, inbox: [...n.inbox, { id: inboxId(now), messageId: e.message, at: now, read: false }] };
    else if ('clearLock' in e) {
      const w = n.wrong[e.clearLock];
      if (w) n = { ...n, wrong: { ...n.wrong, [e.clearLock]: { ...w, lockedUntil: 0 } } };
    }
  }
  return n;
}

/** Подія кличе до рішення, яке вже очікує або ухвалене (напр., через іншу подію) — вдруге не звучить. */
export const decisionAlreadyRaised = (s: GameState, decision?: string) => !!decision && (!!s.decisions[decision] || s.pendingDecisions.includes(decision));

function fireEvent(bundle: CaseBundle, s: GameState, id: string, now: number, silent = false): GameState {
  const e = bundle.events.find((x) => x.id === id);
  if (!e || s.firedEvents.includes(id)) return s;
  if (decisionAlreadyRaised(s, e.decision)) return { ...s, firedEvents: [...s.firedEvents, id] };
  let n: GameState = { ...s, firedEvents: [...s.firedEvents, id] };
  if (!silent) n = { ...n, inbox: [...n.inbox, { id: inboxId(now), messageId: e.message, at: now, read: false }] };
  n = applyEffects(n, e.effects, now);
  if (e.decision && !n.decisions[e.decision] && !silent && !n.pendingDecisions.includes(e.decision)) n = { ...n, pendingDecisions: [...n.pendingDecisions, e.decision] };
  return n;
}

function decide(bundle: CaseBundle, s: GameState, decision: string, option: string, now: number, forced = false): GameState {
  const d = bundle.decisions.find((x) => x.id === decision);
  const o = d?.options.find((x) => x.id === option);
  if (!d || !o || s.decisions[decision]) return s;
  if (!forced) {
    const open = s.pendingDecisions.includes(decision) || (d.available !== undefined && evalCondition(d.available, s));
    if (!open || !evalCondition(o.requires, s)) return s;
  }
  const n = { ...s, decisions: { ...s.decisions, [decision]: option }, pendingDecisions: s.pendingDecisions.filter((x) => x !== decision) };
  return applyEffects(n, o.effects, now);
}

export const GATE_ORDER: GateId[] = ['A', 'B', 'C', 'D'];

/**
 * Шлюз пройдено. Рішення з цим (або ранішим) дедлайном, яке команда вже бачила, але не ухвалила,
 * слідча ухвалює сама — з повідомленням. Рішення, виклик до якого ще не прозвучав, не вирішується
 * мовчки: подія звучить зараз, і команда ухвалює його сама (дедлайн — наступний шлюз).
 */
function applyDeadlines(bundle: CaseBundle, s: GameState, gate: GateId, now: number): GameState {
  let n = s;
  const passed = GATE_ORDER.indexOf(gate);
  for (const d of bundle.decisions) {
    if (!d.deadlineGate || !d.defaultOption || n.decisions[d.id] || n.reserved?.includes(d.id)) continue;
    const due = GATE_ORDER.indexOf(d.deadlineGate);
    if (due > passed) continue;
    const trigger = bundle.events.find((e) => e.decision === d.id && evalCondition(e.requires, n)) ?? bundle.events.find((e) => e.decision === d.id);
    const seen = n.pendingDecisions.includes(d.id) || !trigger;
    if (due === passed && !seen && trigger && !n.firedEvents.includes(trigger.id)) {
      n = fireEvent(bundle, n, trigger.id, now);
      continue;
    }
    if (due === passed && !seen) continue;
    n = { ...n, inbox: [...n.inbox, { id: inboxId(now), messageId: bundle.deadlineNotice, at: now, read: false }] };
    n = decide(bundle, n, d.id, d.defaultOption, now, true);
  }
  return n;
}

export type InterviewStatus = 'available' | 'needsDecision' | 'quotaUsed' | 'done' | 'closed';

/** Подія з рішенням, яку запускає код цього допиту (для акту 1 — Е1 / Р1). */
function gatingEventForInterview(bundle: CaseBundle, id: string) {
  const codes = bundle.codes.filter((c) => 'interview' in c.action && c.action.interview === id).map((c) => c.code);
  return bundle.events.find((e) => e.decision && e.at.onCode?.some((c) => codes.includes(c)));
}

export function interviewStatus(bundle: CaseBundle, s: GameState, id: string): InterviewStatus {
  if (s.interviewsDone.includes(id)) return 'done';
  if (s.flags.case_closed) return 'closed';
  const gating = gatingEventForInterview(bundle, id);
  if (gating?.decision && !s.decisions[gating.decision]) return 'needsDecision';
  if (s.interviewsDone.length >= s.interviewQuota) return 'quotaUsed';
  return 'available';
}

/** Що записати в журнал про дію, яка змінила гру (або null — не записувати). */
function logged(next: GameState, a: Action): LoggedAction | null {
  switch (a.type) {
    case 'decide':
      return { type: 'decide', decision: a.decision, option: a.option };
    case 'interview':
      return next.interviewsDone.includes(a.id) ? { type: 'interview', id: a.id } : { type: 'interview', id: a.id, trigger: true };
    case 'hint':
      return { type: 'hint', task: a.task, n: next.hintsUsed[a.task] };
    case 'solved':
      return { type: 'solved', task: a.task, canon: a.canon };
    case 'code':
      return { type: 'code', code: a.code };
    case 'accuse':
      return { type: 'accuse', answers: a.answers, correct: a.correct };
    case 'penalty':
      return { type: 'penalty', min: a.min, reason: a.reason };
    default:
      return null;
  }
}

export function reduce(bundle: CaseBundle, s0: GameState | null, a: Action): GameState | null {
  // Події, що настали до дії, стаються перед нею — і на живому телефоні, і під час відтворення журналу.
  const s = s0 && 'now' in a && a.type !== 'tick' && a.type !== 'start' ? step(bundle, s0, { type: 'tick', now: a.now }) : s0;
  const next = step(bundle, s, a);
  if (!s || !next || next === s || !('now' in a)) return next;
  const entry = logged(next, a);
  return entry ? { ...next, log: [...next.log, { at: a.now, a: entry }] } : next;
}

function step(bundle: CaseBundle, s: GameState | null, a: Action): GameState | null {
  if (a.type === 'reset') return null;
  if (a.type === 'start') {
    return {
      version: 1,
      caseId: bundle.id,
      id: a.id ?? a.now.toString(36),
      level: a.level,
      mode: a.mode,
      team: a.team.trim(),
      startedAt: a.now - (a.short ? (bundle.short?.offsetMin ?? 0) * 60_000 : 0),
      ...(a.short ? { short: true, freeHints: bundle.short?.optional ?? [] } : {}),
      penaltyMin: 0,
      flags: {},
      decisions: {},
      pendingDecisions: [],
      interviewsDone: [],
      interviewQuota: DEFAULT_INTERVIEW_QUOTA,
      solved: {},
      hintsUsed: {},
      wrong: {},
      firedEvents: [],
      scheduled: [],
      unlocked: ['section:start'],
      inbox: [],
      gatePayloads: {},
      log: [],
    };
  }
  if (!s) return s;
  // Після звинувачення справу закрито: епілог рахується з цього стану, тож він більше не змінюється.
  if (s.accusation && a.type !== 'read') return s;

  switch (a.type) {
    case 'tick': {
      // По одній, від найранішої: подія може запланувати наступну (отруєння → смерть).
      let n = s;
      for (let guard = 0; guard < 100; guard++) {
        const [next] = dueEvents(bundle, n, a.now);
        if (!next) break;
        // не раніше за останню дію гравця: подію, яку дозволила дія, не датуємо минулим
        const floor = n.log.length ? n.log[n.log.length - 1].at : n.startedAt;
        n = fireEvent(bundle, n, next.id, Math.max(next.at, floor));
      }
      return n;
    }
    case 'decide':
      return decide(bundle, s, a.decision, a.option, a.now);
    case 'code': {
      let n = s;
      for (const e of bundle.events) {
        if (e.at.onCode?.includes(a.code) && !n.firedEvents.includes(e.id) && evalCondition(e.requires, n)) n = fireEvent(bundle, n, e.id, a.now);
      }
      return n;
    }
    case 'interview': {
      const status = interviewStatus(bundle, s, a.id);
      if (a.triggerOnly) {
        const trigger = gatingEventForInterview(bundle, a.id);
        return trigger && !s.firedEvents.includes(trigger.id) ? fireEvent(bundle, s, trigger.id, a.now) : s;
      }
      if (status === 'needsDecision') {
        const trigger = gatingEventForInterview(bundle, a.id);
        return trigger && !s.firedEvents.includes(trigger.id) ? fireEvent(bundle, s, trigger.id, a.now) : s;
      }
      if (status !== 'available') return s;
      const iv = bundle.interviews.find((x) => x.id === a.id);
      if (!iv) return s;
      return {
        ...s,
        interviewsDone: [...s.interviewsDone, a.id],
        flags: { ...s.flags, ...iv.flags },
        unlocked: s.unlocked.includes(iv.doc) ? s.unlocked : [...s.unlocked, iv.doc],
      };
    }
    case 'hint': {
      if (!taskVisible(bundle, s, a.task)) return s;
      const used = s.hintsUsed[a.task] ?? 0;
      if (used >= MAX_HINTS) return s;
      return { ...s, hintsUsed: { ...s.hintsUsed, [a.task]: used + 1 }, penaltyMin: s.penaltyMin + (freeHints(bundle, s, a.task) ? 0 : bundle.hintPenaltyMin) };
    }
    case 'solved': {
      if (s.solved[a.task] || !taskVisible(bundle, s, a.task)) return s;
      let n: GameState = { ...s, solved: { ...s.solved, [a.task]: { canon: a.canon, at: a.now } } };
      const task = bundle.tasks.find((t) => t.id === a.task);
      if (task?.gate && a.payload) {
        const p = a.payload as GatePayload;
        n = {
          ...n,
          gatePayloads: { ...n.gatePayloads, [task.gate]: p },
          unlocked: [...n.unlocked, ...p.unlock.filter((u) => !n.unlocked.includes(u))],
          inbox: [...n.inbox, { id: inboxId(a.now), text: p.message, at: a.now, read: false }],
        };
        n = applyDeadlines(bundle, n, task.gate, a.now);
      }
      if (task?.effects) n = applyEffects(n, task.effects, a.now);
      if (task?.onSolved) n = { ...n, inbox: [...n.inbox, { id: inboxId(a.now), messageId: task.onSolved, at: a.now, read: false }] };
      return n;
    }
    case 'wrong': {
      const prev = s.wrong?.[a.task] ?? { count: 0, lockedUntil: 0 };
      const lock = bundle.tasks.find((t) => t.id === a.task)?.lock;
      const per = lock?.after ?? WRONG_PER_LOCK;
      const ms = lock ? lock.minutes * 60_000 : LOCK_MS;
      const count = prev.count + 1;
      const lockedUntil = count % per === 0 ? a.now + ms : prev.lockedUntil;
      return { ...s, wrong: { ...s.wrong, [a.task]: { count, lockedUntil } } };
    }
    case 'accuse':
      if (!canAccuse(bundle, s)) return s;
      return { ...s, accusation: { answers: a.answers, correct: a.correct, at: a.now } };
    case 'read':
      return { ...s, inbox: s.inbox.map((m) => (m.id === a.inboxId ? { ...m, read: true } : m)) };
    case 'penalty':
      return { ...s, penaltyMin: s.penaltyMin + a.min };
  }
}

/** Повідомлення, яке гравець отримав за варіант рішення (з урахуванням умовних ефектів). */
export function optionMessage(bundle: CaseBundle, s: GameState, decision: string, option: string): string | undefined {
  const find = (effects: Effect[] = []): string | undefined => {
    for (const e of effects) {
      if ('message' in e) return e.message;
      if ('if' in e) {
        const m = find(evalCondition(e.if, s) ? e.then : e.else);
        if (m) return m;
      }
    }
    return undefined;
  };
  return find(bundle.decisions.find((d) => d.id === decision)?.options.find((o) => o.id === option)?.effects);
}

/** Рішення, які слідча ухвалить сама, якщо команда зараз розкриє шлюз (ті самі правила, що й у applyDeadlines). */
export function decisionsSettledBy(bundle: CaseBundle, s: GameState, gate: GateId, now: number): string[] {
  const after = applyDeadlines(bundle, s, gate, now);
  return bundle.decisions.filter((d) => after.decisions[d.id] && !s.decisions[d.id]).map((d) => d.id);
}

/** Необов'язкове завдання: завжди (`optional`) або лише в скороченій партії. */
export function isOptional(bundle: CaseBundle, s: GameState, task: string): boolean {
  return !!bundle.tasks.find((t) => t.id === task)?.optional || (!!s.short && !!bundle.short?.optional.includes(task));
}

/** У скороченій партії підказки до необов'язкових завдань безкоштовні. */
export const freeHints = (_bundle: CaseBundle, s: GameState, task: string) => !!s.freeHints?.includes(task);

/** Чи можна зараз висунути звинувачення (один раз, коли виконано умову справи). */
export function canAccuse(bundle: CaseBundle, s: GameState): boolean {
  return !s.accusation && evalCondition(bundle.accusationOpen, s);
}

/** Цифрові документи, які гравець бачить в архіві. */
export function visibleDocs(bundle: CaseBundle, s: GameState): CaseDoc[] {
  return bundle.docs.filter(
    (d) => d.medium === 'app' && s.unlocked.includes(`section:${d.section}`) && (d.open || s.unlocked.includes(d.id)),
  );
}

/** Рішення, доступні будь-коли (умова `available`), які ще не ухвалено. */
export function availableDecisions(bundle: CaseBundle, s: GameState): string[] {
  return bundle.decisions.filter((d) => d.available && !s.decisions[d.id] && evalCondition(d.available, s)).map((d) => d.id);
}

/** Варіанти рішення, умови яких виконано. */
export function optionsFor(bundle: CaseBundle, s: GameState, decision: string): string[] {
  const d = bundle.decisions.find((x) => x.id === decision);
  return d ? d.options.filter((o) => evalCondition(o.requires, s)).map((o) => o.id) : [];
}

/** Завдання, які гравець зараз бачить (гілкові — лише за умови `visibleWhen`). */
export function visibleTasks(bundle: CaseBundle, s: GameState) {
  return bundle.tasks.filter((t) => evalCondition(t.visibleWhen, s));
}

export function taskVisible(bundle: CaseBundle, s: GameState, id: string) {
  const t = bundle.tasks.find((x) => x.id === id);
  return !!t && evalCondition(t.visibleWhen, s);
}
