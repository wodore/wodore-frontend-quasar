<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useUserSettingsStore } from '@stores/user-settings-store';
import { resolveTheme, type ThemeMode } from '@services/theme';

withDefaults(
  defineProps<{
    /** Quasar button size ('md' in the mobile drawer toolbar, 'lg' default) */
    size?: string;
  }>(),
  { size: 'lg' }
);

const { t } = useI18n();
const settings = useUserSettingsStore();

const theme = computed<ThemeMode>(() => resolveTheme(settings.uiSettings.theme));

const options = computed(() => [
  { value: 'auto' as ThemeMode, label: t('theme.auto') },
  { value: 'light' as ThemeMode, label: t('theme.light') },
  { value: 'dark' as ThemeMode, label: t('theme.dark') },
]);

function select(mode: ThemeMode): void {
  settings.updateUISetting('theme', mode);
}
</script>

<template>
  <q-btn flat dense round :size="size" class="text-icon" :aria-label="t('menu.select_theme')">
    <q-icon>
      <IconMdiWeatherSunny v-if="theme === 'light'" />
      <IconMdiWeatherNight v-else-if="theme === 'dark'" />
      <IconMdiThemeLightDark v-else />
    </q-icon>
    <q-tooltip anchor="bottom middle" self="top middle" :delay="500">
      {{ t('menu.select_theme') }}
    </q-tooltip>

    <!-- Styling mirrors WdLanguageSwitcher (inline on the q-menu container;
         see the note there). -->
    <q-menu
      anchor="bottom middle"
      self="top middle"
      :offset="[0, 8]"
      class="bg-dark-500"
      style="
        border-radius: 16px;
        box-shadow:
          0 12px 32px rgba(0, 0, 0, 0.45),
          0 4px 12px rgba(0, 0, 0, 0.35);
      "
    >
      <q-list dense class="text-white theme-menu">
        <q-item
          v-for="option in options"
          :key="option.value"
          clickable
          v-close-popup
          class="theme-menu__item text-white"
          :class="{ 'theme-menu__item--active bg-primary-800': option.value === theme }"
          @click="select(option.value)"
        >
          <q-item-section avatar>
            <q-icon size="xs">
              <IconMdiWeatherSunny v-if="option.value === 'light'" />
              <IconMdiWeatherNight v-else-if="option.value === 'dark'" />
              <IconMdiThemeLightDark v-else />
            </q-icon>
          </q-item-section>
          <q-item-section>{{ option.label }}</q-item-section>
          <q-item-section v-if="option.value === theme" side>
            <q-icon name="wd-checkmark" color="accent-100" size="xs" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<style scoped lang="scss">
.theme-menu {
  min-width: 148px;
  padding: 4px;

  &__item {
    border-radius: 12px;
    min-height: 34px;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
    }
  }
}
</style>
