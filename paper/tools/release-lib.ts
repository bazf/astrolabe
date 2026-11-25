// Чисті функції випуску (tools/release.ts).
import { canonForCheck } from '../shared/answers.ts';

export type ReleaseConfig = { hostCode: string; publicAppUrl: string };

const MIN_CODE = 10;

/**
 * Код ведучого й адреса сайту: зі змінних середовища або з release.local.json (його немає в git).
 * Код із case.yaml для випуску не годиться: він лежить у вихідному коді.
 */
export function releaseConfig(env: Record<string, string | undefined>, file: Partial<ReleaseConfig> | null, caseCode?: string): ReleaseConfig {
  const hostCode = (env.HOST_CODE ?? file?.hostCode ?? '').trim();
  const url = (env.PUBLIC_APP_URL ?? file?.publicAppUrl ?? '').trim();
  if (!hostCode) throw new Error('Немає коду ведучого: задайте HOST_CODE або hostCode у release.local.json.');
  // порівнюємо так, як код стане ключем пульта: регістр, пробіли й тире не важать
  const canon = canonForCheck({ kind: 'text' }, hostCode) ?? '';
  if (caseCode && canon === canonForCheck({ kind: 'text' }, caseCode)) throw new Error('Код ведучого з case.yaml лежить у вихідному коді — для випуску задайте власний HOST_CODE.');
  if (canon.replace(/[^\p{L}\p{N}]/gu, '').length < MIN_CODE) throw new Error(`Код ведучого закороткий (менше ${MIN_CODE} літер і цифр) — його легко вгадати.`);
  if (!url) throw new Error('Немає адреси сайту: задайте PUBLIC_APP_URL або publicAppUrl у release.local.json.');
  return { hostCode, publicAppUrl: url.endsWith('/') ? url : `${url}/` };
}

/** Сторінки друку показують усі конверти — на сайт вони не йдуть (PDF збирає release). */
export const isSiteFile = (path: string) => path !== 'print.html' && !/^assets\/print-/.test(path);

/** Секрети, що потрапили в зібраний сайт: «файл: «секрет»». Регістр не важить. */
export function findLeaks(files: { path: string; text: string }[], secrets: string[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    const hay = f.text.toLowerCase();
    for (const s of secrets) if (s && hay.includes(s.toLowerCase())) out.push(`${f.path}: «${s}»`);
  }
  return out;
}
