<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { setLocale, currentLocale } from '@services/locale';
import { LANGUAGE_OPTIONS } from '@/i18n';

const props = withDefaults(
  defineProps<{
    /** Quasar button size ('md' in the mobile drawer toolbar, 'lg' default) */
    size?: string;
  }>(),
  { size: 'lg' }
);

const { t } = useI18n();

// Reactive read of the active locale (i18n.global.locale is a ref)
const activeLocale = computed(() => currentLocale());
</script>

<template>
  <q-btn
    flat
    dense
    round
    :size="props.size"
    class="text-icon"
    :aria-label="t('menu.select_language')"
  >
    <q-icon><IconMdiTranslate /></q-icon>
    <q-tooltip anchor="bottom middle" self="top middle" :delay="500">
      {{ t('menu.select_language') }}
    </q-tooltip>

    <q-menu anchor="bottom right" self="top right" :offset="[0, 6]">
      <div class="lang-menu bg-dark-500 text-white dialog-radius" style="min-width: 190px">
        <div class="lang-menu__header text-caption text-primary-200 q-px-md q-pt-sm q-pb-xs">
          {{ t('menu.select_language') }}
        </div>
        <q-separator class="lang-menu__separator" />
        <q-list dense padding>
          <q-item
            v-for="option in LANGUAGE_OPTIONS"
            :key="option.value"
            clickable
            v-close-popup
            class="lang-menu__item text-white"
            :class="{ 'lang-menu__item--active bg-primary-800': option.value === activeLocale }"
            @click="setLocale(option.value)"
          >
            <q-item-section>{{ option.label }}</q-item-section>
            <q-item-section v-if="option.value === activeLocale" side>
              <q-icon name="wd-checkmark" color="accent-100" size="xs" />
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </q-menu>
  </q-btn>
</template>

<style scoped lang="scss">
.lang-menu {
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.4),
    0 2px 6px rgba(0, 0, 0, 0.3);

  &__header {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
  }

  &__separator {
    background: rgba(255, 255, 255, 0.12);
  }

  &__item {
    border-radius: 8px;
    margin: 2px 6px;
    min-height: 36px;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
    }
  }
}
</style>
