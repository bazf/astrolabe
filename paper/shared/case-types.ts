// Типи вмісту справи: «авторські» (з YAML) і «зібрані» (у case.json для застосунку).
import type { AnswerSpec, CheckKind } from './answers.ts';
import type { Sealed } from './seal.ts';

export type Level = 'trainee' | 'detective';
export type Mode = 'competition' | 'departments';
export type Section = 'start' | 'A' | 'B' | 'C' | 'D';
export type GateId = 'A' | 'B' | 'C' | 'D';
export type Dept = 'K' | 'A' | 'O';

/** Рядок, що починається з «@», — ключ у файлі текстів (uk/*.yaml). Після збирання — ключ у `strings`. */
export type TextRef = string;

export type Condition =
  | { flag: string; equals?: unknown }
  | { decided: string; option: string }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { unlocked: string }
  | { solved: string }
  | { fired: string }
  | { level: Level }
  | { hintsAtMost: number };

export type Effect =
  | { set: string; value: boolean | number | string }
  | { penaltyMin: number }
  | { unlock: string }
  | { schedule: string; afterMin: number }
  | { message: TextRef }
  /** знімає паузу після невдалих спроб завдання (лічильник лишається) */
  | { clearLock: string }
  | { if: Condition; then: Effect[]; else?: Effect[] };

export type CaseDoc = {
  id: string; // напр. '1-09', 'C02'
  label: string; // як показувати гравцю: «1-09», «Ц-02»
  title: TextRef;
  medium: 'paper' | 'app';
  section: Section;
  sheet?: number;
  dept?: Dept;
  component: string;
  props: Record<string, unknown>;
  levels?: Partial<Record<Level, Record<string, unknown>>>;
  /** цифровий документ видно в архіві з самого початку свого розділу (інакше — лише після unlock) */
  open?: boolean;
};

export type TaskDef = {
  id: string; // 'Z1'
  label: string; // 'З-1'
  title: TextRef;
  question: Record<Level, TextRef>;
  unit?: string;
  gate?: GateId;
  optional?: boolean;
  /** термінове гілкове завдання (напр., доза для реанімації): застосунок показує його на кожному екрані */
  urgent?: boolean;
  spec: Record<Level, AnswerSpec>;
  hints: Record<Level, [TextRef, TextRef, TextRef]>;
  onSolved?: TextRef;
  /** завдання видно лише за умови (напр., гілка отруєння) */
  visibleWhen?: Condition;
  /** наслідки розв'язання */
  effects?: Effect[];
  /** власний замок після помилок (напр., сейф): після кожних `after` — пауза на `minutes` */
  lock?: { after: number; minutes: number };
  /** режим «Відділи»: чиї висновки потрібні */
  depts?: Dept[];
};

export type DecisionOption = { id: string; label: TextRef; effects: Effect[]; requires?: Condition };
export type DecisionDef = {
  id: string; // 'R1'
  label: string; // 'Р1'
  prompt: TextRef;
  /** ситуація для рішення, яке не кличе жодна подія (інакше екран показує повідомлення події) */
  context?: TextRef;
  options: DecisionOption[];
  defaultOption?: string;
  deadlineGate?: GateId;
  /** рішення, яке можна ухвалити будь-коли, поки умова істинна (напр., «звільнити Коржа») */
  available?: Condition;
};

export type EventDef = {
  id: string; // 'E1'
  at: { minute?: number; afterGate?: GateId; plusMin?: number; onCode?: number[]; scheduled?: boolean };
  /** подія спрацьовує лише за цієї умови (напр., розділ архіву відкрито) */
  requires?: Condition;
  message: TextRef;
  decision?: string;
  effects?: Effect[];
};

export type CodeAction =
  | { start: true }
  | { interview: string }
  | { decision: string }
  | { task: string }
  | { doc: string };
export type CodeDef = { code: number; action: CodeAction };

export type InterviewDef = {
  id: string;
  /** документ архіву, у який потрапляє запис допиту */
  doc: string;
  who: TextRef;
  /** прапорці, що ставляться після допиту */
  flags: Record<string, boolean | number | string>;
  lines: { who: TextRef; text: TextRef }[];
};

export type GatePayload = { envelope: GateId; message: string; unlock: string[] };

export type Geometry = {
  town: {
    scale: number;
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
    points: Record<string, { x: number; y: number; label: TextRef }>;
    routes: Record<string, { points: [number, number][]; label?: TextRef }>;
    streets: { points: [number, number][]; name?: TextRef }[];
    areas: Record<string, { points: [number, number][]; label: TextRef }>;
    latitude: string;
    parkHours: string;
    station: { dir: [number, number]; label: TextRef };
  };
  square: {
    scale: number;
    points: Record<string, { x: number; y: number; label: TextRef }>;
  };
};

export type DbSource = { keys: string[]; title: TextRef; body: TextRef };
export type DbBuilt = { hashes: string[]; title: TextRef; body: TextRef };

export type AccusationQuestion = { id: string; prompt: TextRef; options: { id: string; label: TextRef }[]; answer: string };
export type AccusationBuilt = Omit<AccusationQuestion, 'answer'> & { salt: string; answerHash: string };

/** Скорочена партія: годинник стартує з `offsetMin`, шлюз `gate` відкрито, рішення `decide` ухвалено. */
export type ShortGame = { offsetMin: number; gate: GateId; decide: Record<string, string>; optional: string[] };

/** Пульт ведучого (шифрується кодом ведучого; у відкритій збірці його немає). */
export type HostTask = {
  id: string;
  label: string;
  title: string;
  gate?: GateId;
  optional: boolean;
  depts: Dept[];
  /** answer — як показати ведучому; canon — канонічна відповідь, що відкриває шлюз; solution — третя підказка */
  levels: Record<Level, { question: string; answer: string; canon: string; solution: string }>;
};
export type HostDecision = { id: string; label: string; prompt: string; deadline?: GateId; defaultOption?: string; options: { id: string; label: string; after: string[] }[] };
export type HostData = {
  intro: string;
  timeline: { when: string; stage: string; what: string; give: string }[];
  notes: { short: string; departments: string; stuck: string; briefing: string; prep: string; scoring: string; solution: string };
  tasks: HostTask[];
  decisions: HostDecision[];
  /** правильні відповіді на питання звинувачення */
  accusation: { prompt: string; answer: string }[];
};

export type Rules = { title: TextRef; intro: TextRef; sections: { title: TextRef; body: TextRef }[] };

export type CaseSource = {
  id: string;
  title: TextRef;
  docs: CaseDoc[];
  tasks: TaskDef[];
  decisions: DecisionDef[];
  events: EventDef[];
  codes: CodeDef[];
  interviews: InterviewDef[];
  gates: Partial<Record<GateId, { task: string; payload: { message: TextRef; unlock: string[] } }>>;
  hintPenaltyMin: number;
  /** повідомлення, коли слідча ухвалює рішення сама (час вийшов) */
  deadlineNotice: TextRef;
  db?: DbSource[];
  accusation?: AccusationQuestion[];
  /** коли можна висунути звинувачення (наприклад, після операції й рішення про другу групу) */
  accusationOpen?: Condition;
  short?: ShortGame;
  /** код ведучого (у збірку не потрапляє) і штраф за шлюз, відкритий ведучим */
  host?: { code: string; gatePenaltyMin: number };
  /** правила гри без спойлерів: екран «Як грати» і PDF */
  rules?: Rules;
};

export type TaskBuilt = Omit<TaskDef, 'spec'> & {
  check: Record<Level, CheckKind & { salt: string; hashes: string[] }>;
};

export type CaseBundle = Omit<CaseSource, 'tasks' | 'gates' | 'db' | 'accusation' | 'host'> & {
  host?: { sealed: Sealed; gatePenaltyMin: number };
  accusation: AccusationBuilt[];
  db: DbBuilt[];
  dbSalt: string;
  tasks: TaskBuilt[];
  gates: Partial<Record<GateId, { task: string; sealed: Record<Level, Sealed> }>>;
  geometry: Geometry;
  /** ключ → обфускований текст */
  strings: Record<string, string>;
};
