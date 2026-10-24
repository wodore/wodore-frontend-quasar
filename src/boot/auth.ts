import { boot } from 'quasar/wrappers';

import { whenIdle } from '@services/idle';
import { useAuthService } from '@composables/useAuthService';
import { getEnv } from '@services/runtimeEnv';
// "async" is optional;
// more info about params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(async (/* { app, router, ... } */) => {
  // Read-only PR previews share the wodore.github.io ORIGIN with every
  // other preview and every PR — localStorage is origin-wide, so stale
  // OIDC state from an earlier visit can wedge signinSilent in a
  // redirect loop (the "Redirecting..." screen). Previews are login-less
  // by design: skip the silent login there entirely.
  if (getEnv('WODORE_ENV') === 'preview') return;
  const $auth = useAuthService();
  // Silent login is never boot-critical (public endpoints do not need
  // the token; authenticated calls fetch on demand) — but UserManager
  // setup + the hidden iframe cost main-thread time during boot.
  // Defer to the first idle slot (perf/boot-parallel).
  void whenIdle(() => $auth.signinSilent()).catch(error =>
    console.warn('Could not silent login', error)
  );
});
