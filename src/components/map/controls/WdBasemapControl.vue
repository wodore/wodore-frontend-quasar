<script setup lang="ts">
/**
 * WdBasemapControl — basemap selector (matches the overlay control box).
 * Opens to the LEFT (same as before, new design without q-fab).
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBasemapStore } from '@stores/map/basemap-store';

const { t } = useI18n();
const basemapStore = useBasemapStore();

const open = ref(true);

const iconOpen = new URL(
  '/src/assets/wodore-design/icons/export/basemap-switch.svg',
  import.meta.url
).href;
const iconClose = new URL(
  '/src/assets/wodore-design/icons/export/basemap-switch-close.svg',
  import.meta.url
).href;

const activeName = computed(() => basemapStore.getBasemap()?.name);

function selectBasemap(name: string): void {
  const bm = basemapStore.basemaps.find(b => b.name === name);
  if (bm) {
    basemapStore.setBasemap(bm);
  }
}
</script>

<template>
  <div class="wd-bm">
    <!-- Mini strip: opens to the LEFT of the toggle (horizontal on desktop) -->
    <Transition name="wd-bm-strip">
      <div v-if="open" class="wd-bm__rail">
        <button
          v-for="bm in basemapStore.basemaps"
          :key="bm.name"
          v-show="bm.show"
          class="wd-bm__btn"
          :class="{
            'wd-bm__btn--active': activeName === bm.name,
            'wd-bm__btn--inactive': activeName !== bm.name,
          }"
          :aria-label="bm.label"
          :aria-pressed="activeName === bm.name"
          :title="bm.label"
          @click="selectBasemap(bm.name)"
        >
          <img v-if="bm.img" :src="bm.img" :alt="bm.label" class="wd-bm__thumb" />
          <q-icon v-else name="wd-layers" size="22px" />
        </button>
      </div>
    </Transition>

    <!-- Toggle (48px, same width as overlay toggle) -->
    <button
      class="wd-bm__toggle"
      :aria-label="t('basemap')"
      :aria-expanded="open"
      @click="open = !open"
    >
      <img
        :src="open ? iconClose : iconOpen"
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
  align-items: flex-end;
  gap: 4px;
}

// rail: horizontal strip that extends LEFT from the toggle
.wd-bm__rail {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-direction: row-reverse; // rightmost = first (closest to toggle)
}

.wd-bm__btn {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 4px;
  border: 1px solid var(--wd-ctl-border);
  background: var(--wd-ctl-bg);
  color: var(--wd-ctl-ink);
  cursor: pointer;
  box-shadow: var(--wd-ctl-shadow);
  display: grid;
  place-items: center;
  overflow: hidden;
  transition: box-shadow 0.12s ease, opacity 0.12s ease;
  flex: none;
}

.wd-bm__btn--inactive {
  opacity: 0.8;
}

.wd-bm__btn--active {
  box-shadow: inset 0 0 0 2px var(--wd-ctl-ring);
  opacity: 1;
}

.wd-bm__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wd-bm__toggle {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 1px solid var(--wd-ctl-border);
  background: var(--wd-ctl-bg);
  cursor: pointer;
  box-shadow: var(--wd-ctl-shadow);
  transition: background-color 0.15s ease;
  flex: none;
  padding: 6px;

  &:hover {
    background: var(--wd-ctl-hover);
  }
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

// collapse animation (slides in from the right)
.wd-bm-strip-enter-active,
.wd-bm-strip-leave-active {
  transition: opacity 0.18s cubic-bezier(0.2, 0, 0, 1), transform 0.18s cubic-bezier(0.2, 0, 0, 1);
}
.wd-bm-strip-enter-from,
.wd-bm-strip-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
