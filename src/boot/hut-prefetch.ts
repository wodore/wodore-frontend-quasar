/**
 * Earliest possible hut deep-link prefetch (perf/hut-fast-first-paint):
 * see services/hut-prefetch.ts. Runs before i18n/storage/theme so a
 * /hut/:slug arrival starts its API request within milliseconds of the
 * bundle executing — the response is handed to usePlace later.
 */
import { defineBoot } from '#q-app';
import { startHutPrefetch } from '@services/hut-prefetch';

export default defineBoot(() => {
  startHutPrefetch();
});
