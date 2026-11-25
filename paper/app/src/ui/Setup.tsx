import { useState } from 'react';
import type { Level, Mode } from '../../../shared/case-types.ts';
import { startShort } from '../engine/short.ts';
import { useApp } from './gameContext.tsx';
import { ui } from './strings.ts';

/** Форма старту. `onStarted` вирішує, куди перейти далі. */
export function Setup({ title, onStarted }: { title: string; onStarted: () => void }) {
  const { bundle, game } = useApp();
  const [team, setTeam] = useState('');
  const [level, setLevel] = useState<Level>('trainee');
  const [mode, setMode] = useState<Mode>('competition');
  const [short, setShort] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card setup"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return; // подвійне натискання не створює двох команд
        setBusy(true);
        const name = team.trim() || 'Слідча група';
        const now = Date.now();
        try {
          if (short) game.put(await startShort(bundle, { level, mode, team: name, now, id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}` }));
          else game.dispatch({ type: 'start', level, mode, team: name, now });
          onStarted();
        } catch {
          setBusy(false);
        }
      }}
    >
      <h1>{title}</h1>
      <a className="rules-link" href="#/rules">
        {ui.rulesLink}
      </a>
      <label className="field">
        <span>{ui.teamLabel}</span>
        <input aria-label={ui.teamLabel} value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Сови" maxLength={40} />
      </label>
      <fieldset className="field">
        <legend>{ui.levelLabel}</legend>
        <label className="choice">
          <input type="radio" name="level" checked={level === 'trainee'} onChange={() => setLevel('trainee')} /> {ui.levelTrainee}
        </label>
        <label className="choice">
          <input type="radio" name="level" checked={level === 'detective'} onChange={() => setLevel('detective')} /> {ui.levelDetective}
        </label>
      </fieldset>
      <fieldset className="field">
        <legend>{ui.modeLabel}</legend>
        <label className="choice">
          <input type="radio" name="mode" checked={mode === 'competition'} onChange={() => setMode('competition')} /> {ui.modeCompetition}
        </label>
        <label className="choice">
          <input type="radio" name="mode" checked={mode === 'departments'} onChange={() => setMode('departments')} /> {ui.modeDepartments}
        </label>
      </fieldset>
      {bundle.short && (
        <fieldset className="field">
          <legend>{ui.lengthLabel}</legend>
          <label className="choice">
            <input type="radio" name="length" checked={!short} onChange={() => setShort(false)} /> {ui.lengthFull}
          </label>
          <label className="choice">
            <input type="radio" name="length" checked={short} onChange={() => setShort(true)} /> {ui.lengthShort}
          </label>
        </fieldset>
      )}
      <button type="submit" className="btn btn--primary" disabled={busy}>
        {ui.startButton}
      </button>
    </form>
  );
}
