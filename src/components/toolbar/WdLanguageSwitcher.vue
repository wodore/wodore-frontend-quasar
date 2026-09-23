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

    <q-menu anchor="bottom right" self="top right">
      <q-list dense class="bg-dark-500 text-white dialog-radius" style="min-width: 160px">
        <q-item
          v-for="option in LANGUAGE_OPTIONS"
          :key="option.value"
          clickable
          v-close-popup
          :active="option.value === activeLocale"
          class="text-white"
          @click="setLocale(option.value)"
        >
          <q-item-section>{{ option.label }}</q-item-section>
          <q-item-section v-if="option.value === activeLocale" side>
            <q-icon name="wd-checkmark" size="xs" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>
</template>
