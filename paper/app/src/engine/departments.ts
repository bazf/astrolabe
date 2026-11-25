// Режим «Відділи» (біблія, розд. 13): три відділи голосують, за нічиєї вирішує керівник групи.
import type { Dept } from '../../../shared/case-types.ts';

export const DEPTS: Dept[] = ['K', 'A', 'O'];

export function tallyVotes(votes: Partial<Record<Dept, string>>, lead?: string): { winner: string | null; tie: boolean } {
  const cast = DEPTS.map((d) => votes[d]).filter((v): v is string => !!v);
  if (cast.length < DEPTS.length) return { winner: null, tie: false };
  const counts = new Map<string, number>();
  for (const v of cast) counts.set(v, (counts.get(v) ?? 0) + 1);
  const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (n >= 2) return { winner: top, tie: false };
  return { winner: lead && cast.includes(lead) ? lead : null, tie: true };
}
