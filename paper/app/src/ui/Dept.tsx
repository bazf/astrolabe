import type { Dept } from '../../../shared/case-types.ts';
import { ui } from './strings.ts';

/** Значок відділу: К — криміналісти, А — аналітики, О — оперативники. */
export function DeptBadge({ dept }: { dept: Dept }) {
  return (
    <span className={`dept dept--${dept}`} title={ui.deptNames[dept]}>
      {ui.deptLetters[dept]}
    </span>
  );
}
