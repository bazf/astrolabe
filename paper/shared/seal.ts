// Хешування відповідей і запечатування вмісту за шлюзами (WebCrypto: Node 20+ і браузер).
// Це не захист від зламу (простір відповідей малий), а гарантія, що відповіді
// й закритий вміст не читаються у вихідному коді застосунку.

/** Ключ скороченої партії: відкриває лише шлюз, який ведучий видає розкритим (див. `short` у case.yaml). */
export const SHORT_GAME_KEY = 'skorochena-partiia';

export type Sealed = {
  salt: string;
  /** hashAnswer(salt, canon) → iv‖ключ, зашифрований ключем, виведеним з відповіді (base64) */
  wraps: Record<string, string>;
  /** iv‖ciphertext вмісту (base64) */
  box: string;
};

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();
const PBKDF2_ITERATIONS = 50_000;

const toB64 = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const concat = (a: Uint8Array, b: Uint8Array) => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
};
const randomBytes = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export async function hashAnswer(salt: string, canon: string): Promise<string> {
  const digest = new Uint8Array(await subtle.digest('SHA-256', enc.encode(`${salt}\u0000${canon}`)));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function keyFromAnswer(salt: string, canon: string): Promise<CryptoKey> {
  const base = await subtle.importKey('raw', enc.encode(canon), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function aesEncrypt(key: CryptoKey, data: Uint8Array): Promise<string> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  return toB64(concat(iv, ct));
}

async function aesDecrypt(key: CryptoKey, b64: string): Promise<Uint8Array | null> {
  const bytes = fromB64(b64);
  try {
    return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12)));
  } catch {
    return null;
  }
}

export async function sealWithAnswers(payload: unknown, salt: string, accepted: string[]): Promise<Sealed> {
  const raw = randomBytes(32);
  const contentKey = await subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const box = await aesEncrypt(contentKey, enc.encode(JSON.stringify(payload)));
  const wraps: Record<string, string> = {};
  for (const canon of accepted) {
    wraps[await hashAnswer(salt, canon)] = await aesEncrypt(await keyFromAnswer(salt, canon), raw);
  }
  return { salt, wraps, box };
}

/**
 * Секрет без швидкого індексу (код ведучого): обгортка лежить під ключем «*», тож кожна спроба
 * вгадати код коштує повного PBKDF2, а не одного SHA-256.
 */
export async function sealWithSecret(payload: unknown, salt: string, secret: string): Promise<Sealed> {
  const sealed = await sealWithAnswers(payload, salt, [secret]);
  return { ...sealed, wraps: { '*': Object.values(sealed.wraps)[0] } };
}

export async function openSealed(sealed: Sealed, canon: string): Promise<unknown | null> {
  const wrap = sealed.wraps['*'] ?? sealed.wraps[await hashAnswer(sealed.salt, canon)];
  if (!wrap) return null;
  const raw = await aesDecrypt(await keyFromAnswer(sealed.salt, canon), wrap);
  if (!raw) return null;
  const contentKey = await subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  const plain = await aesDecrypt(contentKey, sealed.box);
  return plain ? JSON.parse(dec.decode(plain)) : null;
}

const OBF_KEY = enc.encode('starokamin-vezha-mayatnyk');

export function obfuscate(s: string): string {
  const bytes = enc.encode(s);
  return toB64(bytes.map((b, i) => b ^ OBF_KEY[i % OBF_KEY.length]));
}

export function deobfuscate(s: string): string {
  const bytes = fromB64(s);
  return dec.decode(bytes.map((b, i) => b ^ OBF_KEY[i % OBF_KEY.length]));
}
