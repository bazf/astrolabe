import { describe, expect, it } from 'vitest';
import { deobfuscate, hashAnswer, obfuscate, openSealed, sealWithAnswers } from './seal.ts';

describe('sealWithAnswers / openSealed', () => {
  it('opens only with an accepted canonical answer', async () => {
    const sealed = await sealWithAnswers({ x: 1 }, 'g-a', ['1.7', '1.8']);
    expect(await openSealed(sealed, '1.8')).toEqual({ x: 1 });
    expect(await openSealed(sealed, '1.7')).toEqual({ x: 1 });
    expect(await openSealed(sealed, '1.5')).toBeNull();
  });

  it('leaks neither answers nor payload in its serialized form', async () => {
    const sealed = await sealWithAnswers({ x: 1 }, 'g-a', ['1.7', '1.8']);
    const json = JSON.stringify(sealed);
    expect(json).not.toContain('1.8');
    expect(json).not.toContain('"x"');
  });

  it('salts hashes so equal answers differ across gates', async () => {
    expect(await hashAnswer('g-a', '1.8')).not.toBe(await hashAnswer('g-b', '1.8'));
    expect(await hashAnswer('g-a', '1.8')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('obfuscate', () => {
  it('round-trips Ukrainian text and hides it', () => {
    const text = 'Корж — біля дверей вежі о 22:09:30';
    expect(deobfuscate(obfuscate(text))).toBe(text);
    expect(obfuscate('Корж')).not.toContain('Корж');
  });
});
