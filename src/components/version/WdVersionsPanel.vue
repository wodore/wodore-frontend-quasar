<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { PINNED_API_VERSION } from '@services/apiVersion';
import { getBackendVersion } from '@services/backendVersion';
import {
  isDebugEnabled,
  disableDebugTools,
  setDebugEnabled,
  syncDebugParam,
} from '@services/debug-tools';
import WdVersionTag from './WdVersionTag.vue';

const frontendVersion = process.env.WODORE_APP_VERSION || '';
const frontendHash = process.env.WODORE_GIT_HASH || '';

// Debug-tools hidden switch (owner spec): DOUBLE-click the frontend
// version row → enable the eruda stack; SINGLE click while ON →
// disable. No visible toggle — the gold frontend icon + the bug
// behind the version are the ON signal. Reloads because debug tools
// attach at boot, from first paint. A stray single click while OFF
// does nothing (enable is dblclick-only, native threshold).
const debugOn = ref(isDebugEnabled());
function onFrontVersionClick(): void {
  if (!debugOn.value) return;
  // Off tears down the WHOLE testing setup: eruda, the ?debug URL
  // param (when present) and the net/cache knobs (owner spec — a
  // disabled inspector must never leave a throttled/cold session).
  disableDebugTools();
  syncDebugParam(false);
  window.location.reload();
}
function onFrontVersionDblClick(): void {
  if (debugOn.value) return; // the first click already disabled it
  setDebugEnabled(true);
  syncDebugParam(true);
  window.location.reload();
}

const backendVersion = ref<string>('');
const backendHash = ref<string>('');
const backendLoading = ref(false);
const backendError = ref<string | null>(null);

const fetchBackendVersion = async () => {
  backendLoading.value = true;
  backendError.value = null;

  try {
    // Shared 5-min cached call (owner request: ONE /v1/version per
    // session — the api-version store check reuses the same fetch).
    const info = await getBackendVersion();
    backendVersion.value = info.version;
    backendHash.value = info.hashLong;
  } catch (err) {
    backendError.value = err instanceof Error ? err.message : 'Failed to fetch backend version';
    console.error('Failed to fetch backend version:', err);
  } finally {
    backendLoading.value = false;
  }
};

onMounted(fetchBackendVersion);
</script>

<style scoped>
/* Debug-ON markers (owner spec): the frontend version icon goes gold
   and a large, dimmed BUG sits behind the row. The switch itself is
   the hidden gesture on this row: double-click ON / single click OFF. */
.wd-versions__front-row {
  position: relative;
  cursor: pointer;
}

.wd-versions__front-row--debug :deep(.q-icon) {
  color: #bfab25 !important; /* meadow-gold = $accent — beats wd-ink-soft-text */
}

.wd-versions__bug-bg {
  position: absolute;
  right: -2px;
  top: 50%;
  transform: translateY(-50%) rotate(-12deg);
  color: #bfab25; /* meadow-gold = $accent */
  opacity: 0.14;
  pointer-events: none;
  z-index: 0;
}

/* real phones: keep clear of the gesture bar */
:deep(.q-pb-xl),
.column {
  padding-bottom: calc(1.5rem + var(--q-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
}
</style>

<template>
  <div class="wd-versions column q-gutter-y-xs q-pb-xl q-px-sm q-mt-md">
    <div class="wd-versions__label wd-ink-soft-text">Build</div>
    <div
      class="row items-center no-wrap justify-between wd-versions__front-row"
      :class="{ 'wd-versions__front-row--debug': debugOn }"
      @click="onFrontVersionClick"
      @dblclick="onFrontVersionDblClick"
    >
      <WdVersionTag type="frontend" :version="frontendVersion" :hash="frontendHash" />
      <!-- Debug ON marker (owner spec): a large dimmed BUG sits BEHIND the
           frontend version — with the toggle gone, this is the in-panel
           signal that eruda is live (double-click the row to enable,
           single click to disable). -->
      <q-icon
        v-if="debugOn"
        name="wd-debug"
        size="56px"
        class="wd-versions__bug-bg"
        aria-hidden="true"
      />
    </div>
    <WdVersionTag
      type="backend"
      :version="backendVersion"
      :hash="backendHash"
      :loading="backendLoading"
      :error="backendError"
    />
    <div class="row items-center no-wrap q-gutter-xs">
      <q-tooltip self="center right" anchor="center right" :delay="1000" :offset="[-5, 0]">
        API version — backend CHANGELOG_API.md
      </q-tooltip>
      <q-icon name="wd-api" size="14px" class="wd-ink-soft-text" />
      <span class="text-caption wd-ink-soft-text">
        <span class="text-weight-medium">
          <a
            target="_blank"
            href="https://github.com/wodore/wodore-backend/blob/main/CHANGELOG_API.md"
            >API {{ PINNED_API_VERSION || '—' }}</a
          >
        </span>
      </span>
    </div>
  </div>
</template>
