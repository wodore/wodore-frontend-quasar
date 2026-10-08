<script setup lang="ts">
//
// Passive banner for API version lifecycle problems: deprecated pin
// (update recommended, sunset date shown) / retired pin (update required,
// either from the startup registry check or from live 410 responses).
// Never blocks the app and never auto-switches the pin.
//
// Platform-aware remedy (the pin is baked into the build):
// - native (Capacitor): only an app update helps — informational text only
// - web/PWA: a hard reload fetches the current build — offer a reload
//   button that also activates a waiting service worker (SKIP_WAITING,
//   same flow as the PWA update notification)
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Platform } from 'quasar';
import { useApiVersionStore } from '@stores/api-version-store';
import { triggerNativeAppUpdate } from '@services/appUpdate';

const { t, d } = useI18n();
const store = useApiVersionStore();
const dismissed = ref(false);
const isNative = Platform.is.nativeMobile;

// Native remedy: Play in-app update when available, store entry otherwise
// (see src/services/appUpdate.ts); a canceled native flow does nothing more.
// The store button is native-only — web/PWA gets the reload button.
function onUpdateTap(): void {
  void triggerNativeAppUpdate();
}

onMounted(() => {
  void store.checkApiVersion();
});

const variant = computed<'deprecated' | 'unsupported' | null>(() => {
  if (dismissed.value) return null;
  if (store.sunsetErrorSeen) return 'unsupported';
  const state = store.check.state;
  if (state === 'deprecated') return 'deprecated';
  if (state === 'unsupported') return 'unsupported';
  return null;
});

const message = computed(() => {
  const check = store.check;
  const sunset =
    check.state === 'deprecated' || check.state === 'unsupported' ? check.entry?.sunset : null;
  const datePart = sunset ? ` (${d(new Date(sunset), 'short')})` : '';
  const scope =
    variant.value === 'deprecated' ? 'api_version_deprecated' : 'api_version_unsupported';
  return `${t(isNative ? `${scope}_native` : `${scope}_web`)}${datePart}`;
});

/**
 * Hard reload for web/PWA: force a service-worker update check, activate a
 * waiting worker (the pwa-update boot reloads on controllerchange), or
 * plain-reload when no service worker is involved.
 */
async function hardReload(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
      if (reg?.waiting) {
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => window.location.reload(),
          { once: true }
        );
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        return;
      }
    }
  } catch {
    // fall through to a plain reload
  }
  window.location.reload();
}
</script>

<template>
  <q-banner
    v-if="variant"
    dense
    class="q-px-md q-py-xs"
    :class="variant === 'unsupported' ? 'bg-negative text-white' : 'bg-amber-2 text-black'"
  >
    <template #avatar>
      <q-icon :name="variant === 'unsupported' ? 'eva-alert-circle-outline' : 'eva-info-outline'" />
    </template>
    {{ message }}
    <template #action>
      <q-btn
        v-if="isNative"
        flat
        dense
        size="sm"
        :label="t('api_version_update')"
        class="q-ml-sm"
        @click="onUpdateTap"
      />
      <q-btn
        v-else
        flat
        dense
        size="sm"
        :label="t('api_version_reload')"
        class="q-ml-sm"
        @click="hardReload"
      />
      <q-btn flat dense size="sm" icon="close" :aria-label="t('close')" @click="dismissed = true" />
    </template>
  </q-banner>
</template>
