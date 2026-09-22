/**
 * Latest-wins guard for async operations fired from watchers or debounced
 * handlers. Each call to next() invalidates all previous tokens; wrap the
 * async work, capture the token, and bail when isLatest(token) is false.
 *
 * @example
 * const latest = useLatestRequest();
 * const token = latest.next();
 * const data = await fetch(...);
 * if (!latest.isLatest(token)) return; // a newer request superseded this one
 */
export function useLatestRequest() {
  let counter = 0;
  const next = () => ++counter;
  const isLatest = (token: number) => token === counter;
  return { next, isLatest };
}
