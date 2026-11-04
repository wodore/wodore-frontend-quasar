<script setup lang="ts">
/**
 * WdGeoLink — the small bottom-right `geo:` affordance for map popups
 * (amenity, cluster, transport). Same URL pattern as the place detail's
 * location row and the mobile actions toolbar (`geo:lat,lon`,
 * target=_blank — the OS maps handler takes over); icon-only by default,
 * with the coordinates label available for detail contexts.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(defineProps<{ lat: number; lon: number; label?: boolean }>(), {
  label: false,
});

const { t } = useI18n();
const href = computed(() => `geo:${props.lat},${props.lon}`);
</script>

<template>
  <a :href="href" target="_blank" class="wd-geo-link" :aria-label="t('place.geo.aria')">
    <q-icon name="wd-location-share-outline" size="14px" />
    <span v-if="label">{{ lat.toPrecision(7) }}, {{ lon.toPrecision(6) }}</span>
  </a>
</template>

<style lang="scss" scoped>
.wd-geo-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--wd-ink-soft);
  text-decoration: none;
  font-size: 12px;
  line-height: 1;

  &:hover,
  &:focus-visible {
    color: var(--wd-ink);
  }
}
</style>
