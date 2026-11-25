import { useEffect, useState } from 'react';

export type Route = { name: string; param?: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] ?? '', param: parts[1] };
}

export const navigate = (path: string) => {
  if (window.location.hash !== path) window.location.hash = path;
};

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    on();
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
