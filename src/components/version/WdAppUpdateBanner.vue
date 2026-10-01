<script setup lang="ts">
//
// Native app update nudge (Android/Capacitor, via Google Play).
//
// Default: silent. When Play reports an update, it downloads in the
// background; a passive notification offers the restart once ready.
// Only apps >= 14 days behind get the persistent banner (see
// STALENESS_ESCALATION_DAYS). Nothing is shown on web/PWA or side-loaded
// builds (Play reports no update for them).
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Platform, useQuasar } from 'quasar';
import { AppUpdate } from '@capawesome/capacitor-app-update';
import {
  checkForAppUpdateOnStartup,
  triggerNativeAppUpdate,
} from '@services/appUpdate';

const { t } = useI18n();
const $q = useQuasar();
const isNative = Platform.is.nativeMobile;

const escalated = ref(false);
const downloadReady = ref(false);

function notifyRestartReady(): void {
  downloadReady.value = true;
  // Passive, dismissable — the update is already on disk; installing it
  // on the next manual app restart works too.
  $q.notify({
    type: 'info',
    message: t('app_update_ready'),
    timeout: 0,
    position: 'top',
    actions: [
      { label: t('app_update_restart'), color: 'white', handler: () => restart() },
      { label: t('pwa.later_button'), color: 'white', handler: () => {} },
    ],
  });
}

function restart(): void {
  void AppUpdate.completeFlexibleUpdate().catch(() => {
    // no downloaded flexible update (race) — fall back to the full flow
    void triggerNativeAppUpdate();
  });
}

function onUpdateTap(): void {
  if (downloadReady.value) {
    restart();
  } else {
    // Not downloaded yet (or flexible not allowed): immediate full-screen
    // update when allowed, store entry otherwise.
    void triggerNativeAppUpdate();
  }
}

onMounted(() => {
  if (!isNative) return;
  void checkForAppUpdateOnStartup(notifyRestartReady).then(check => {
    escalated.value = check.escalated;
  });
});
</script>

<template>
  <q-banner
    v-if="isNative && escalated"
    dense
    class="bg-negative text-white q-px-md q-py-xs"
  >
    <template #avatar>
      <q-icon name="eva-alert-circle-outline" />
    </template>
    {{ t('app_update_stale_banner') }}
    <template #action>
      <q-btn
        flat
        dense
        size="sm"
        :label="downloadReady ? t('app_update_restart') : t('api_version_update')"
        class="q-ml-sm"
        @click="onUpdateTap"
      />
    </template>
  </q-banner>
</template>
