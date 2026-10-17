import { boot } from 'quasar/wrappers';

import { initErrorTracking } from '@services/sentry';

// Error tracking boot (openspec: add-error-tracking) — FIRST in the
// boot list and client-only on purpose: the global error hooks are
// installed before any later boot file runs, mirroring the backend
// loading its sentry settings component before everything else. The
// service itself is DSN-gated — without WODORE_SENTRY_DSN this is a
// no-op (dev/test/CI/preview).
export default boot(({ app, router }) => {
  initErrorTracking(app, router);
});
