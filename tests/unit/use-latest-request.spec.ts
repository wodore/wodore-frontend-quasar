import { describe, it, expect } from 'vitest';
import * as allure from 'allure-js-commons';
import { useLatestRequest } from '@composables/useLatestRequest';

describe('useLatestRequest', () => {
  it('invalidates older tokens when next() is called', () => {
    allure.label('feature', 'async-guards');
    allure.severity('critical');

    const latest = useLatestRequest();
    const first = latest.next();
    expect(latest.isLatest(first)).toBe(true);

    const second = latest.next();
    expect(latest.isLatest(first)).toBe(false);
    expect(latest.isLatest(second)).toBe(true);
  });

  it('isLatest is true only for the newest token', () => {
    const latest = useLatestRequest();
    const tokens = [latest.next(), latest.next(), latest.next()];
    expect(tokens.map(t => latest.isLatest(t))).toEqual([false, false, true]);
  });
});
