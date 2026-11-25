import { visibleTasks } from '../engine/reducer.ts';
import { useApp } from './gameContext.tsx';
import type { Route } from './router.ts';
import { envelopeLabel, ui } from './strings.ts';

/**
 * Те, що не можна проґавити, — на кожному екрані: рішення, що чекають (з дедлайном),
 * і термінові гілкові завдання. Сліпі проходження показали: з дашборду їх не видно, коли команда
 * переходить від задачі до задачі, і слідча вирішувала за команду, якої та навіть не бачила.
 */
export function Attention({ route }: { route: Route }) {
  const { bundle, game, t } = useApp();
  const s = game.state;
  if (!s || s.accusation) return null;
  const decisions = s.pendingDecisions.filter((d) => !(route.name === 'decision' && route.param === d));
  const urgent = visibleTasks(bundle, s).filter((task) => task.urgent && !s.solved[task.id] && !(route.name === 'task' && route.param === task.id));
  if (!decisions.length && !urgent.length) return null;
  return (
    <div className="attention">
      {urgent.map((task) => (
        <a key={task.id} className="banner banner--warn" href={`#/task/${task.id}`}>
          <strong>{ui.urgent}</strong> · {task.label}. {t(task.title)}
        </a>
      ))}
      {decisions.map((d) => {
        const dec = bundle.decisions.find((x) => x.id === d)!;
        return (
          <a key={d} className="banner banner--action" href={`#/decision/${d}`}>
            <strong>{ui.decisionPending}</strong> · {t(dec.prompt)}
            {dec.deadlineGate && <span className="muted"> · {ui.decisionDue(envelopeLabel(dec.deadlineGate))}</span>}
          </a>
        );
      })}
    </div>
  );
}
