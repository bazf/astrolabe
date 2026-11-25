import { useMemo, useState } from 'react';
import type { CaseBundle } from '../../../shared/case-types.ts';
import { DocProvider, makeT } from '../documents/context.tsx';
import { elapsedMin } from '../engine/reducer.ts';
import { CodeEntry, CodeRoute, Scanner } from './Codes.tsx';
import { Dashboard } from './Dashboard.tsx';
import { Accuse, EpilogueScreen } from './Finale.tsx';
import { Database } from './Database.tsx';
import { DecisionScreen } from './DecisionScreen.tsx';
import { Archive, DocScreen, EnvelopeScreen } from './Docs.tsx';
import { GameCtx, fmtClock, useApp } from './gameContext.tsx';
import { InterviewScreen } from './InterviewScreen.tsx';
import { navigate, useHashRoute, type Route } from './router.ts';
import { Attention } from './Attention.tsx';
import { RulesScreen } from './Rules.tsx';
import { Setup } from './Setup.tsx';
import { ui } from './strings.ts';
import { TaskScreen } from './TaskScreen.tsx';
import { JoinScreen, TeamScreen } from './Team.tsx';
import { HostScreen } from './Host.tsx';
import { useGame } from './useGame.ts';
import '../documents/documents.css';
import './app.css';

/** База даних поліції (Ц-11) — «з акту 2». */
const DB_SECTION = 'section:A';

const appBaseUrl = () => (typeof window === 'undefined' ? '' : window.location.href.split('#')[0]);

function Home() {
  const { game } = useApp();
  const [ask, setAsk] = useState(false);
  if (!game.state) return <Setup title={ui.startQuestion} onStarted={() => navigate('#/case')} />;
  return (
    <section className="card">
      <h1>{ui.appTitle}</h1>
      <a className="btn btn--primary" href="#/case">
        {ui.continueButton}
      </a>
      <button className="btn" onClick={() => navigate('#/setup')}>
        {ui.addTeam}
      </button>
      <p className="muted">{ui.addTeamHint}</p>
      <a className="btn" href="#/rules">
        {ui.rulesLink}
      </a>
      <a className="btn" href="#/host">
        {ui.hostLink}
      </a>
      {ask ? (
        <div className="confirm">
          <p>{ui.newGameConfirm(game.state.team)}</p>
          <button
            className="btn"
            onClick={() => {
              game.dispatch({ type: 'reset' });
              setAsk(false);
            }}
          >
            {ui.yes}
          </button>
        </div>
      ) : (
        <button className="btn" onClick={() => setAsk(true)}>
          {ui.newGame}
        </button>
      )}
    </section>
  );
}

function Screen({ route }: { route: Route }) {
  const { game } = useApp();
  if (route.name === 'code') return <CodeRoute param={route.param} />;
  if (route.name === 'join') return <JoinScreen code={route.param} />;
  if (route.name === 'host') return <HostScreen />;
  if (route.name === 'rules') return <RulesScreen />;
  if (route.name === 'setup') return <Setup title={ui.startQuestion} onStarted={() => navigate('#/case')} />;
  if (!game.state || route.name === '') return <Home />;
  switch (route.name) {
    case 'case':
      return <Dashboard />;
    case 'enter':
      return <CodeEntry />;
    case 'scan':
      return <Scanner />;
    case 'archive':
      return <Archive />;
    case 'db':
      return game.state.unlocked.includes(DB_SECTION) ? <Database /> : <section className="card">{ui.dbClosed}</section>;
    case 'doc':
      return <DocScreen id={route.param} />;
    case 'task':
      return <TaskScreen id={route.param} />;
    case 'decision':
      // key: голоси одного рішення не переходять на інше
      return <DecisionScreen key={route.param} id={route.param} />;
    case 'interview':
      return <InterviewScreen id={route.param} />;
    case 'envelope':
      return <EnvelopeScreen id={route.param} />;
    case 'accuse':
      return <Accuse />;
    case 'epilogue':
      return <EpilogueScreen />;
    case 'team':
      return <TeamScreen />;
    default:
      return <Home />;
  }
}

export default function App({ bundle, clock }: { bundle: CaseBundle; clock?: () => number }) {
  const game = useGame(bundle, clock);
  const route = useHashRoute();
  const t = useMemo(() => makeT(bundle), [bundle]);
  const s = game.state;
  const body = (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="topbar__title">
          {ui.appTitle}
        </a>
        {game.games.length > 1 && s && (
          <select className="team-picker" aria-label={ui.teamPicker} value={s.id} onChange={(e) => game.switchTo(e.target.value)}>
            {game.games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.team}
              </option>
            ))}
          </select>
        )}
        {s && (
          <span className="timer" aria-label={ui.timer}>
            {fmtClock(elapsedMin(s, game.now))}
            {s.penaltyMin > 0 && <span className="timer__penalty">+{s.penaltyMin}</span>}
          </span>
        )}
      </header>
      {!game.storageOk && <div className="banner banner--warn">{ui.storageWarning}</div>}
      {s && !['host', 'join', 'setup'].includes(route.name) && <Attention route={route} />}
      <main className="main">
        <Screen route={route} />
      </main>
      {s && (
        <nav className="tabbar" style={{ gridTemplateColumns: `repeat(${s.unlocked.includes(DB_SECTION) ? 5 : 4}, 1fr)` }}>
          <a href="#/case" className={route.name === 'case' ? 'active' : ''}>
            {ui.navCase}
          </a>
          <a href="#/enter" className={route.name === 'enter' ? 'active' : ''}>
            {ui.navCode}
          </a>
          <a href="#/scan" className={route.name === 'scan' ? 'active' : ''}>
            {ui.navScan}
          </a>
          <a href="#/archive" className={route.name === 'archive' || route.name === 'doc' ? 'active' : ''}>
            {ui.navArchive}
          </a>
          {s.unlocked.includes(DB_SECTION) && (
            <a href="#/db" className={route.name === 'db' ? 'active' : ''}>
              {ui.navDb}
            </a>
          )}
        </nav>
      )}
    </div>
  );
  return (
    <GameCtx.Provider value={{ bundle, game, t }}>
      {s ? (
        <DocProvider bundle={bundle} level={s.level} baseUrl={appBaseUrl()}>
          {body}
        </DocProvider>
      ) : (
        body
      )}
    </GameCtx.Provider>
  );
}
