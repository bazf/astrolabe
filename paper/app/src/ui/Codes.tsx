import { useEffect, useRef, useState } from 'react';
import { normalizeCode } from '../../../shared/answers.ts';
import type { CaseBundle } from '../../../shared/case-types.ts';
import { useApp } from './gameContext.tsx';
import { navigate } from './router.ts';
import { Setup } from './Setup.tsx';
import { ui } from './strings.ts';

/** Куди веде код. null — коду немає у справі. */
export function codeTarget(bundle: CaseBundle, n: number): string | null {
  const c = bundle.codes.find((x) => x.code === n);
  if (!c) return null;
  const a = c.action;
  if ('start' in a) return '#/case';
  if ('interview' in a) return `#/interview/${a.interview}`;
  if ('task' in a) return `#/task/${a.task}`;
  if ('decision' in a) return `#/decision/${a.decision}`;
  return `#/doc/${a.doc}`;
}

export function CodeRoute({ param }: { param?: string }) {
  const { bundle, game } = useApp();
  const n = normalizeCode(param ?? '');
  const target = n === null ? null : codeTarget(bundle, n);
  const started = !!game.state;
  useEffect(() => {
    if (!started || !target || n === null) return;
    game.dispatch({ type: 'code', code: n, now: Date.now() });
    navigate(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, target, n]);
  if (!target) return <UnknownCode />;
  if (!game.state) return <Setup title={ui.startQuestion} onStarted={() => navigate(target)} />;
  return null;
}

function UnknownCode() {
  return (
    <div className="card">
      <p className="alert">{ui.unknownCode}</p>
      <a className="btn" href="#/enter">
        {ui.enterCode}
      </a>
    </div>
  );
}

export function CodeEntry() {
  const { bundle } = useApp();
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        const n = normalizeCode(value);
        const target = n === null ? null : codeTarget(bundle, n);
        if (!target) return setError(true);
        navigate(`#/code/${n}`);
      }}
    >
      <h1>{ui.enterCode}</h1>
      <label className="field">
        <span>{ui.codeLabel}</span>
        <input
          aria-label={ui.codeLabel}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="АС-000"
        />
      </label>
      <p className="muted">{ui.codeHint}</p>
      {error && <p className="alert">{ui.unknownCode}</p>}
      <button className="btn btn--primary" type="submit">
        {ui.open}
      </button>
    </form>
  );
}

export function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    (async () => {
      try {
        const { default: QrScanner } = await import('qr-scanner');
        if (cancelled || !video.current) return;
        const sc = new QrScanner(
          video.current,
          (r) => {
            // QR з екрана «Команда» іншого телефона
            const join = r.data.indexOf('#/join/');
            if (join >= 0) {
              sc.stop();
              navigate(r.data.slice(join));
              return;
            }
            const n = normalizeCode(r.data);
            if (n !== null) {
              sc.stop();
              navigate(`#/code/${n}`);
            }
          },
          { highlightScanRegion: true, preferredCamera: 'environment' },
        );
        stop = () => sc.destroy();
        await sc.start();
      } catch {
        setError(ui.scanError);
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, []);
  return (
    <div className="card scanner">
      <h1>{ui.scanTitle}</h1>
      {error ? <p className="alert">{error}</p> : <video ref={video} className="scanner__video" muted playsInline />}
      <a className="btn" href="#/enter">
        {ui.enterCode}
      </a>
    </div>
  );
}
