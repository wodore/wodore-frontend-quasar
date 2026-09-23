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

    <!-- Styling sits INLINE on the q-menu container (attrs.style passes
         through to the .q-menu element) — this Quasar version's QMenu has no
         content-class/style props, its own .q-menu rules override utility
         classes, and a shadow on an inner element would be clipped by the
         container's overflow:hidden. -->
    <q-menu
      anchor="bottom middle"
      self="top middle"
      :offset="[0, 8]"
      class="bg-dark-500"
      style="
        border-radius: 20px;
        box-shadow:
          0 12px 32px rgba(0, 0, 0, 0.45),
          0 4px 12px rgba(0, 0, 0, 0.35);
      "
    >
      <q-list dense class="text-white lang-menu">
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
    </q-menu>
  </q-btn>
</template>

<style scoped lang="scss">
.lang-menu {
  min-width: 128px;
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
