<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useUserSettingsStore } from '@stores/user-settings-store';
import type { ThemeMode } from '@services/theme';

withDefaults(
  defineProps<{
    /** Quasar button size ('md' in the mobile drawer toolbar, 'lg' default) */
    size?: string;
  }>(),
  { size: 'lg' }
);

const { t } = useI18n();
const settings = useUserSettingsStore();

const ORDER: ThemeMode[] = ['auto', 'light', 'dark'];

// The icon and tooltip show the chosen SETTING (auto = follow system), not
// the resolved theme - clicking cycles the setting itself.
const mode = computed<ThemeMode>(() => {
  const stored = settings.uiSettings.theme;
  return ORDER.includes(stored) ? stored : 'auto';
});

const label = computed(() => t(`theme.${mode.value}`));

function cycle(): void {
  const next = ORDER[(ORDER.indexOf(mode.value) + 1) % ORDER.length];
  settings.updateUISetting('theme', next);
}
</script>

<template>
  <q-btn
    flat
    dense
    round
    :size="size"
    class="text-icon"
    :aria-label="label"
    data-testid="theme-cycle"
    @click="cycle()"
  >
    <q-icon>
      <IconMdiWeatherSunny v-if="mode === 'light'" />
      <IconMdiWeatherNight v-else-if="mode === 'dark'" />
      <IconMdiThemeLightDark v-else />
    </q-icon>
    <q-tooltip anchor="bottom middle" self="top middle" :delay="300">
      {{ label }}
    </q-tooltip>
  </q-btn>
</template>
