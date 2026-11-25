// Адреса розгорнутого застосунку, на яку ведуть QR у друці.
export const PLACEHOLDER_URL = 'https://example.github.io/astrolabe/';

/** Без PUBLIC_APP_URL друк зупиняється: інакше QR вели б на неіснуючий сайт. */
export function publicAppUrl(env: Record<string, string | undefined>): string {
  const url = env.PUBLIC_APP_URL?.trim();
  if (url) return url.endsWith('/') ? url : `${url}/`;
  if (env.ALLOW_PLACEHOLDER_URL === '1') return PLACEHOLDER_URL;
  throw new Error('Задайте PUBLIC_APP_URL (адресу розгорнутого застосунку) або ALLOW_PLACEHOLDER_URL=1 для пробного друку.');
}

/** Код ведучого: HOST_CODE (для справжнього розгортання) або код із case.yaml. Той самий код запечатує пульт і друкується в посібнику. */
export function hostCode(env: Record<string, string | undefined>, fromCase: string): string {
  return env.HOST_CODE?.trim() || fromCase.trim();
}

/** Назви PDF — так, як гра називає комплекти й посібник (рівні — як у застосунку). */
const PRINT_NAMES = {
  trainee: 'Справа № 17 — комплект «Стажер».pdf',
  detective: 'Справа № 17 — комплект «Слідчий».pdf',
  guide: 'Справа № 17 — посібник ведучого.pdf',
  rules: 'Справа № 17 — правила гри.pdf',
} as const;

export const printFile = (what: keyof typeof PRINT_NAMES) => PRINT_NAMES[what];

/** Усі PDF випуску: правила гри, комплекти обох рівнів і посібник ведучого. */
export const PRINT_FILES: string[] = [PRINT_NAMES.rules, PRINT_NAMES.trainee, PRINT_NAMES.detective, PRINT_NAMES.guide];
