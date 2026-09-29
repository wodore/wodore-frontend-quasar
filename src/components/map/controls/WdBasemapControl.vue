<script setup lang="ts">
/**
 * WdBasemapControl — basemap selector (matches the overlay control).
 *
 * Same architecture: a main toggle + a mini strip of basemap thumbnails
 * inside a boxed surface. Tap a thumbnail to switch basemaps.
 * No q-fab — pure HTML buttons.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBasemapStore } from '@stores/map/basemap-store';

const { t } = useI18n();
const basemapStore = useBasemapStore();

const open = ref(true);

const toggleIcon = new URL(
  '/src/assets/wodore-design/icons/export/basemap-switch.svg',
  import.meta.url
).href;
const toggleIconClose = new URL(
  '/src/assets/wodore-design/icons/export/basemap-switch-close.svg',
  import.meta.url
).href;

const activeBasemap = computed(() => basemapStore.getBasemap()?.name);

function selectBasemap(name: string): void {
  const bm = basemapStore.basemaps.find(b => b.name === name);
  if (bm) {
    basemapStore.setBasemap(bm);
  }
}
</script>

<template>
  <div class="wd-bm">
    <Transition name="wd-bm-strip">
      <div v-if="open" class="wd-bm__box">
        <div class="wd-bm__strip" role="group" :aria-label="t('basemap')">
          <button
            v-for="bm in basemapStore.basemaps"
            :key="bm.name"
            class="wd-map-btn wd-map-btn--sm wd-bm__item"
            :class="{
              'wd-map-btn--active': activeBasemap === bm.name,
              'wd-map-btn--inactive': activeBasemap !== bm.name,
            }"
            :aria-label="bm.label"
            :aria-pressed="activeBasemap === bm.name"
            :title="bm.label"
            @click="selectBasemap(bm.name)"
          >
            <img v-if="bm.img" :src="bm.img" :alt="bm.label" class="wd-bm__thumb" />
            <q-icon v-else name="wd-layers" size="22px" />
          </button>
        </div>
      </div>
    </Transition>

    <button
      class="wd-map-btn wd-map-btn--lg wd-bm__toggle"
      :aria-label="t('basemap')"
      :aria-expanded="open"
      @click="open = !open"
    >
      <img
        :src="open ? toggleIconClose : toggleIcon"
        alt=""
        class="wd-bm__toggle-icon"
        :class="{ 'wd-bm__toggle-icon--open': open }"
      />
    </button>
  </div>
</template>

<style lang="scss" scoped>
.wd-bm {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.wd-bm__box {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--wd-ctl-bg);
  border: 1px solid var(--wd-ctl-border);
  border-radius: 8px;
  box-shadow: var(--wd-ctl-shadow);
  padding: 3px;
  flex: none;
}

.wd-bm__strip {
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: center;
  max-height: calc(100dvh - 400px);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  mask-image: linear-gradient(to bottom, black 90%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 90%, transparent 100%);
}

.wd-bm__item {
  overflow: hidden;
  border-radius: 4px;
}

.wd-bm__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.wd-bm__toggle-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
}

.wd-bm__toggle-icon--open {
  transform: rotate(180deg);
}

// collapse animation
.wd-bm-strip-enter-active,
.wd-bm-strip-leave-active {
  transition:
    opacity 0.18s cubic-bezier(0.2, 0, 0, 1),
    transform 0.18s cubic-bezier(0.2, 0, 0, 1);
}

.wd-bm-strip-enter-from,
.wd-bm-strip-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
