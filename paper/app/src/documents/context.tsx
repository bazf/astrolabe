import { createContext, useContext, type ReactNode } from 'react';
import { deobfuscate } from '../../../shared/seal.ts';
import type { CaseBundle, Level } from '../../../shared/case-types.ts';

export type DocContext = {
  bundle: CaseBundle;
  level: Level;
  /** true — друк у міліметрах; false — екран застосунку */
  print: boolean;
  /** база для QR: https://…/#/code/<n> */
  baseUrl: string;
  /** «@ключ» → текст; інший рядок повертається як є */
  t: (ref: unknown) => string;
};

const Ctx = createContext<DocContext | null>(null);

export function makeT(bundle: CaseBundle) {
  return (ref: unknown): string => {
    if (typeof ref !== 'string') return ref == null ? '' : String(ref);
    if (!ref.startsWith('@')) return ref;
    const key = ref.slice(1);
    const v = bundle.strings[key];
    return v === undefined ? `⟨${key}⟩` : deobfuscate(v);
  };
}

export function DocProvider(props: { bundle: CaseBundle; level: Level; print?: boolean; baseUrl?: string; children: ReactNode }) {
  const value: DocContext = {
    bundle: props.bundle,
    level: props.level,
    print: props.print ?? false,
    baseUrl: props.baseUrl ?? '',
    t: makeT(props.bundle),
  };
  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useDoc(): DocContext {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDoc поза DocProvider');
  return v;
}

export const codeLabel = (n: number) => `АС-${String(n).padStart(3, '0')}`;
export const codeUrl = (baseUrl: string, n: number) => `${baseUrl}#/code/${n}`;

/** Текст з абзацами (порожній рядок) і переносами. */
export function Paras({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((p, i) => (
        <p key={i} className={className}>
          {p.split('\n').map((line, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}
