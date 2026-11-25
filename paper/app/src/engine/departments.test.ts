import { describe, expect, it } from 'vitest';
import { tallyVotes } from './departments.ts';

describe('department votes', () => {
  it('waits for all three departments', () => {
    expect(tallyVotes({ K: 'a', A: 'a' })).toEqual({ winner: null, tie: false });
  });

  it('a majority decides', () => {
    expect(tallyVotes({ K: 'a', A: 'b', O: 'a' })).toEqual({ winner: 'a', tie: false });
    expect(tallyVotes({ K: 'c', A: 'c', O: 'c' })).toEqual({ winner: 'c', tie: false });
  });

  it('a three-way split goes to the group lead, who must pick one of the votes', () => {
    expect(tallyVotes({ K: 'a', A: 'b', O: 'c' })).toEqual({ winner: null, tie: true });
    expect(tallyVotes({ K: 'a', A: 'b', O: 'c' }, 'b')).toEqual({ winner: 'b', tie: true });
    expect(tallyVotes({ K: 'a', A: 'b', O: 'c' }, 'd')).toEqual({ winner: null, tie: true });
  });
});
