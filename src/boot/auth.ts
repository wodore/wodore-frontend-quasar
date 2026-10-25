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
  void whenIdle(async () => {
    // Zitadel answers its authorize endpoints with
    // `Content-Security-Policy: frame-ancestors 'none'`, so the hidden
    // iframe oidc-client-ts spins up in signinSilent WITHOUT a stored
    // refresh token is always blocked by the browser — an anonymous
    // visitor's probe can only ever log a CSP violation + a dead
    // request. Keep only the path that works: with a stored refresh
    // token (offline_access scope) signinSilent takes the token grant
    // directly, no iframe involved.
    const user = await $auth.userManager.getUser();
    if (!user?.refresh_token) return;
    await $auth.signinSilent();
  }).catch(error => console.warn('Could not silent login', error));
});
