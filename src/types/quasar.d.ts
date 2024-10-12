// should not be needed, but somehow got missing $q and $t errors :(

import { Quasar } from 'quasar';
import 'vue';
import { Composer } from 'vue-i18n';

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $q: Quasar;
    $t: Composer['t']; // Use the Composer type to infer the correct signature for $t
  }
}
