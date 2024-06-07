import { boot } from 'quasar/wrappers';

import { useAuthService } from '@composables/useAuthService';
// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(async (/* { app, router, ... } */) => {
  // something to do
  const $auth = useAuthService();
  $auth
    .signinSilent()
    .then()
    .catch((error) => console.warn('Could not silent login', error));
});
