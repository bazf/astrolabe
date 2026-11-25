import { useEffect, useRef, useState } from 'react';
import { Qr } from '../documents/Qr.tsx';
import { decodeGame, encodeGame, mergeGame, replayGame, sameGame, toSyncData, type SyncData } from '../engine/sync.ts';
import { useApp } from './gameContext.tsx';
import { navigate } from './router.ts';
import { ui } from './strings.ts';

const pageBase = () => window.location.href.split('#')[0];

/** Поділитися грою з іншими телефонами команди: QR або посилання. */
export function TeamScreen() {
  const { game } = useApp();
  const s = game.state!;
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    void encodeGame(toSyncData(s)).then((code) => alive && setLink(`${pageBase()}#/join/${code}`));
    return () => {
      alive = false;
    };
    // журнал змінюється лише з діями гравців — QR не перемальовується щосекунди
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.id, s.log, s.team]);
  return (
    <section className="card team">
      <h1>{ui.teamTitle}</h1>
      <p>{ui.teamHowTo}</p>
      {link && (
        <>
          <div className="team__qr">
            <Qr value={link} sizeMm={70} label={ui.teamQr} />
          </div>
          <div className="team__actions">
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button className="btn btn--primary" onClick={() => void navigator.share({ title: ui.appTitle, url: link }).catch(() => {})}>
                {ui.teamShare}
              </button>
            )}
            <button
              className="btn"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(link)
                  .then(() => setCopied(true))
                  .catch(() => {})
              }
            >
              {copied ? ui.teamCopied : ui.teamCopy}
            </button>
            <a className="btn" href="#/scan">
              {ui.teamScan}
            </a>
          </div>
        </>
      )}
    </section>
  );
}

/** Відкрито посилання іншого телефона: зливаємо прогрес або додаємо команду. */
export function JoinScreen({ code }: { code?: string }) {
  const { bundle, game } = useApp();
  const [data, setData] = useState<SyncData | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    void decodeGame(code ?? '').then((d) => alive && setData(d && d.caseId === bundle.id ? d : null));
    return () => {
      alive = false;
    };
  }, [code, bundle.id]);

  const local = data ? game.games.find((g) => sameGame(g, data)) : undefined;
  const conflict = !!data && !local && game.games.length > 0;

  const apply = async (kind: 'merge' | 'add' | 'replace') => {
    if (!data || busy.current) return;
    busy.current = true;
    try {
      const now = Date.now();
      let next = kind === 'merge' && local ? await mergeGame(bundle, local, data, now) : await replayGame(bundle, data, now);
      // той самий id в іншої гри цього пристрою (інший рівень) — не затираємо її
      if (kind === 'add' && game.games.some((g) => g.id === next.id)) next = { ...next, id: `${next.id}-${now.toString(36)}` };
      if (kind === 'replace') game.dispatch({ type: 'reset' });
      game.put(next);
      navigate('#/case');
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  };

  useEffect(() => {
    if (data && !conflict) void apply(local ? 'merge' : 'add');
    // рішення ухвалюється один раз — коли посилання розшифровано
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (data === null) return <section className="card alert">{ui.joinBroken}</section>;
  if (failed) return <section className="card alert">{ui.joinFailed}</section>;
  if (!conflict) return <section className="card">{ui.joinWorking}</section>;
  return (
    <section className="card">
      <p>{ui.joinChoice(data!.team)}</p>
      <div className="team__actions">
        <button className="btn btn--primary" onClick={() => void apply('add')}>
          {ui.joinAdd}
        </button>
        <button className="btn" onClick={() => void apply('replace')}>
          {ui.joinReplace(game.state?.team ?? '')}
        </button>
      </div>
    </section>
  );
}
