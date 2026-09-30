<script setup lang="ts">
/**
 * WdBasemapControl — basemap picker (v2, opens LEFT).
 *
 * A compact 48px toggle; the rail opens to the LEFT with full-bleed
 * image thumbnails. Selecting a basemap closes the rail again (like
 * the old version). Starts closed, state persisted.
 */
import { ref, watch, computed, onBeforeUnmount } from 'vue';
import { LocalStorage } from 'quasar';
import { useBasemapStore } from '@stores/map/basemap-store';

const basemapStore = useBasemapStore();

const open = ref(
  LocalStorage.hasItem('wd_bm_open') ? (LocalStorage.getItem('wd_bm_open') as boolean) : false
);
watch(open, v => LocalStorage.set('wd_bm_open', v));

// Reactive: track the store's current basemap (also updates after
// initial style load / persisted state restoration)
const activeName = computed(() => basemapStore.getBasemap()?.name);

/** Click outside the control closes the rail */
function onDocClick(ev: Event): void {
  const target = ev.target as HTMLElement;
  if (!target.closest('.wd-bm')) open.value = false;
}

watch(open, v => {
  if (v) document.addEventListener('click', onDocClick, { capture: true });
  else document.removeEventListener('click', onDocClick, { capture: true });
});

onBeforeUnmount(() => document.removeEventListener('click', onDocClick, { capture: true }));

function selectBasemap(bm: { name: string }): void {
  const item = basemapStore.basemaps.find(b => b.name === bm.name);
  if (item) basemapStore.setBasemap(item);
  open.value = false; // close after selection (previous behavior)
}

const iconOpen = new URL('/src/assets/wodore-design/icons/export/basemap-switch.svg', import.meta.url).href;
const iconClose = new URL('/src/assets/wodore-design/icons/export/basemap-switch-close.svg', import.meta.url).href;
</script>

<template>
  <div class="wd-bm">
    <!-- Rail: opens to the LEFT of the toggle -->
    <Transition name="wd-bm-rail">
      <div v-if="open" class="wd-bm__rail" role="group" aria-label="Basemap">
        <button
          v-for="bm in basemapStore.basemaps.filter(b => b.show)"
          :key="bm.name"
          class="wd-bm__btn"
          :class="{
            'wd-bm__btn--active': activeName === bm.name,
            'wd-bm__btn--inactive': activeName !== bm.name,
          }"
          :aria-label="bm.label"
          :aria-pressed="activeName === bm.name"
          @click="selectBasemap(bm)"
        >
          <img :src="bm.img" :alt="bm.label" class="wd-bm__thumb" />
        </button>
      </div>
    </Transition>

    <!-- Toggle -->
    <button
      class="wd-bm__toggle"
      :aria-label="'Basemap'"
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
$ease: cubic-bezier(0.2, 0, 0, 1);

.wd-bm {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  pointer-events: none; // map gestures pass through
}

// ── Rail (opens LEFT) ────────────────────────────────────────────────────
.wd-bm__rail {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--wd-ctl-border); // same border width as overlay toggle
  background: var(--wd-ctl-bg);
  box-shadow: var(--wd-ctl-shadow);
  pointer-events: auto;
  // Scrollable when the rail would leave the viewport
  max-width: calc(100vw - 24px);
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
  }
  scroll-snap-type: x proximity;
}

// ── Basemap buttons: full-bleed images, solid (no transparency) ─────────
.wd-bm__btn {
  position: relative;
  width: 48px;
  height: 48px;
  scroll-snap-align: start;
  padding: 0;
  border-radius: 4px;
  border: 2px solid transparent; // reserve space for gold selection
  background: var(--wd-ctl-bg);
  cursor: pointer;
  display: grid;
  place-items: center;
  overflow: hidden;
  transition:
    border-color 0.15s $ease,
    transform 0.1s $ease;
  flex: none;

  &:active {
    transform: scale(0.95);
  }

  &--active {
    border-color: #bfab25; // gold selection beam
  }

  &--inactive {
    border-color: var(--wd-ctl-border);
  }
}

.wd-bm__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.wd-bm__thumb--empty {
  display: grid;
  place-items: center;
  font-size: 10px;
  color: var(--wd-ctl-ink-soft);
}

// Dark theme: brighten thumbnails
body.body--dark .wd-bm__thumb {
  filter: brightness(1.15) saturate(1.1);
}

// ── Toggle (matches overlay toggle: 48px, 1px border) ───────────────────
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
  transition:
    background-color 0.15s $ease,
    transform 0.1s $ease;
  flex: none;
  padding: 8px;
  outline: none;
  pointer-events: auto;

  &:active {
    transform: scale(0.96);
  }
}

.wd-bm__toggle-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.35s $ease;
}

.wd-bm__toggle-icon--open {
  transform: rotate(360deg);
}

// ── Rail transition: slide in from the right (opening LEFT) ─────────────
.wd-bm-rail-enter-active,
.wd-bm-rail-leave-active {
  transition:
    opacity 0.22s $ease,
    transform 0.22s $ease;
}

.wd-bm-rail-enter-from,
.wd-bm-rail-leave-to {
  opacity: 0;
  transform: translateX(8px);
}
</style>
