<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import WodoreLogo from 'components/wodore/WodoreLogo.vue';

/** The single map-loading placeholder (owner spec, 2026-10): the
 *  map-colored grid background (identical to the index.html boot shell
 *  and the old MapPage placeholder — pixel for pixel), the Wodore logo
 *  and a spinner, shown continuously from first paint until the base
 *  basemap AND the overlays have rendered, then faded out.
 *
 *  `rendered` flips the loader to its faded-out state (kept in the DOM
 *  for the 250 ms CSS fade; pointer-events pass through immediately).
 */
interface Props {
  rendered?: boolean;
}

withDefaults(defineProps<Props>(), { rendered: false });

const { t } = useI18n();
</script>

<template>
  <div
    class="wd-map-loader background-map"
    :class="{ 'wd-map-loader--out': rendered }"
    role="status"
    :aria-label="t('map.loading')"
  >
    <div class="wd-map-loader__inner">
      <WodoreLogo :icon="true" />
      <q-spinner-grid size="50px" color="secondary" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* Grid background — moved here from MapPage.vue so the boot shell
 * (index.html) and every map-loading phase share ONE visual. The
 * values stay identical: the index.html boot shell mirrors them
 * inline (see the comment there). */
.background-map {
  background-color: #dddddd;
  opacity: 1;
  background-image:
    linear-gradient(#d0d0d0 1.6px, transparent 1.6px),
    linear-gradient(90deg, #d0d0d0 1.6px, transparent 1.6px),
    linear-gradient(#d0d0d0 0.8px, transparent 0.8px),
    linear-gradient(90deg, #d0d0d0 0.8px, #dddddd 0.8px);
  background-size:
    40px 40px,
    40px 40px,
    8px 8px,
    8px 8px;
  background-position:
    -1.6px -1.6px,
    -1.6px -1.6px,
    -0.8px -0.8px,
    -0.8px -0.8px;
}

/* Dark theme: match the boot shell's night grid (index.html + design
   tokens .body--dark: page #0a140f, ridge #1c3629) so the
   shell → loader handover stays dark for dark-theme users. */
.body--dark .background-map {
  background-color: #0a140f;
  background-image:
    linear-gradient(#1c3629 1.6px, transparent 1.6px),
    linear-gradient(90deg, #1c3629 1.6px, transparent 1.6px),
    linear-gradient(#1c3629 0.8px, transparent 0.8px),
    linear-gradient(90deg, #1c3629 0.8px, #0a140f 0.8px);
}

.wd-map-loader {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.25s ease-out;
}

.wd-map-loader--out {
  opacity: 0;
  pointer-events: none;
}

.wd-map-loader__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}
</style>
