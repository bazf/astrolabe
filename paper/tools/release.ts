// Випуск: сайт для GitHub Pages і PDF для друку з одним кодом ведучого й справжньою адресою.
// Запуск: npm run release  (HOST_CODE і PUBLIC_APP_URL — у змінних або в release.local.json, якого немає в git)
// Результат: release/site (викласти на GitHub Pages) і release/print (PDF комплектів і посібника ведучого).
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { deobfuscate } from '../shared/seal.ts';
import { PRINT_FILES } from './print-config.ts';
import { findLeaks, isSiteFile, releaseConfig } from './release-lib.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localFile = join(root, 'release.local.json');
const caseCode = (parse(readFileSync(join(root, 'content/cases/astrolabe/case.yaml'), 'utf8')) as { host: { code: string } }).host.code;
const cfg = releaseConfig(process.env, existsSync(localFile) ? JSON.parse(readFileSync(localFile, 'utf8')) : null, caseCode);
const env = { ...process.env, HOST_CODE: cfg.hostCode, PUBLIC_APP_URL: cfg.publicAppUrl };
const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { cwd: root, env, stdio: 'inherit' });

console.log(`Випуск для ${cfg.publicAppUrl}`);
run('npm', ['run', 'build']);

// Жодного секрету в сайті: ні коду ведучого (нашого й типового з case.yaml), ні текстів пульта.
const dist = join(root, 'app/dist');
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const textFiles = walk(dist)
  .filter((p) => /\.(js|css|html|json|webmanifest|svg)$/.test(p))
  .map((p) => ({ path: relative(dist, p), text: readFileSync(p, 'utf8') }));
const hostTexts = Object.values((parse(readFileSync(join(root, 'content/cases/astrolabe/uk/host.yaml'), 'utf8')) as { host: Record<string, unknown> }).host)
  .flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v as Record<string, Record<string, string>>).flatMap((r) => Object.values(r))))
  .flatMap((v) => v.split('\n'))
  .map((line) => line.trim().slice(0, 40))
  .filter((line) => line.length >= 25);
// Публічні рядки обфусковані — перевіряємо й розшифровані тексти справи.
const bundle = JSON.parse(readFileSync(join(root, 'app/src/generated/case.json'), 'utf8')) as { strings: Record<string, string> };
const hostKeys = Object.keys(bundle.strings).filter((k) => k.startsWith('host.'));
const plain = { path: 'case.json (розшифровані рядки)', text: Object.values(bundle.strings).map(deobfuscate).join('\n') };
const leaks = [...hostKeys.map((k) => `case.json: ключ ${k}`), ...findLeaks([...textFiles, plain], [cfg.hostCode, caseCode, ...hostTexts])];
if (leaks.length) {
  console.error(`У зібраному сайті є те, чого там бути не повинно:\n- ${leaks.join('\n- ')}`);
  process.exit(1);
}
console.log(`Перевірка витоків: ${textFiles.length} файлів чисті.`);

run('node', ['--experimental-strip-types', '--no-warnings', 'tools/build-print.ts']);

const out = join(root, 'release');
rmSync(out, { recursive: true, force: true });
// без сторінок друку: вони показують усі конверти, а PDF лежать у release/print
cpSync(dist, join(out, 'site'), { recursive: true, filter: (src) => isSiteFile(relative(dist, src).split('\\').join('/')) });
const extra = walk(join(out, 'site')).map((p) => relative(join(out, 'site'), p)).filter((p) => !isSiteFile(p));
if (extra.length) throw new Error(`У сайт потрапили сторінки друку: ${extra.join(', ')}`);
// GitHub Pages без Jekyll віддає файли як є
writeFileSync(join(out, 'site/.nojekyll'), '');
mkdirSync(join(out, 'print'), { recursive: true });
for (const f of PRINT_FILES) cpSync(join(root, 'print/out', f), join(out, 'print', f));

console.log(`
Готово.
  Сайт:  ${join(out, 'site')}  → викласти на ${cfg.publicAppUrl}
  Друк:  ${join(out, 'print')}  (правила гри, комплекти «Стажер», «Слідчий» і посібник ведучого з кодом)
Посібник ведучого містить код ведучого — не викладайте його разом із сайтом.`);
