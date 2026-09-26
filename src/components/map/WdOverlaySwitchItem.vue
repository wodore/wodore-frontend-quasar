<script setup lang="ts">
import { computed } from 'vue';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useMapMenuStore } from '@stores/map/map-menu-store';

interface Props {
  label: string;
  icon: string;
  active?: boolean | undefined;
  tooltip?: boolean | undefined;
  overlayName: string;
  showBadge?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  configure: [tab?: string];
  toggleOverlay: [];
}>();

const overlayStore = useOverlayStore();
const menuStore = useMapMenuStore();

const overlayConfig = computed(() => {
  const overlay = overlayStore.overlays.find((o): boolean => o.name === props.overlayName) as
    | (typeof overlayStore.overlays)[number]
    | undefined;
  return overlay?.config;
});

const hasFilters = computed(() => {
  return (overlayConfig.value?.filters?.length ?? 0) > 0;
});

const hasInfo = computed(() => {
  return overlayConfig.value?.legend !== undefined;
});

const isInfoActive = computed(() => {
  return (
    menuStore.menuOpen &&
    menuStore.menuType === 'overlay-config' &&
    menuStore.menuData.overlayName === props.overlayName &&
    menuStore.menuData.initialTab === 'legend'
  );
});

const isFilterActive = computed(() => {
  return (
    menuStore.menuOpen &&
    menuStore.menuType === 'overlay-config' &&
    menuStore.menuData.overlayName === props.overlayName &&
    menuStore.menuData.initialTab === 'filter'
  );
});

function onMainClick() {
  emit('toggleOverlay');
}

function onInfoClick(event: Event) {
  event.stopPropagation();

  // If info is already open for this overlay, close it
  if (isInfoActive.value) {
    menuStore.closeMenu();
  } else {
    // Otherwise open info (will close filter if open)
    emit('configure', 'legend');
  }
}

function onFilterClick(event: Event) {
  event.stopPropagation();

  // If filter is already open for this overlay, close it
  if (isFilterActive.value) {
    menuStore.closeMenu();
  } else {
    // Otherwise open filter (will close info if open)
    emit('configure', 'filter');
  }
}
</script>

<style lang="scss" scoped>
.overlay-switch-item {
  display: flex;
  align-items: stretch;
  overflow: visible;
  /*
  border-radius: 100px;
  background: color('icon');
  box-shadow: $button-shadow;
  transition: background-color 0.2s;

  &:last-child {
    border-bottom: 3px solid rgba(0, 0, 0, 0.15);
  }
  */
}

.overlay-main-btn {
  height: 40px;
  width: 30px;
  padding: 0;
  margin: 0;
  border-radius: 100;
  background: transparent;
  transition: color 0.2s;

  .q-icon {
    opacity: 0.85;
    color: var(--wd-chrome-btn-ink);
  }

  // Raster activity symbols (huts, bike, hiking, ...): dark glyphs float
  // on the light map in Day (no bg). At Night they get a pine disc and the
  // glyph inverts to light ice - dark PNGs would vanish on pine.
  img {
    display: block;
  }

  // Active: gold icon, no fill (product rule: no icon bg in any state)
  &.active {
    .q-icon {
      opacity: 1;
      color: #bfab25;
    }

    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }

  &:hover {
    background-color: var(--wd-chrome-btn-hover);
  }
}

// Night rail treatment for image-bearing overlay buttons (activity rail):
// pine disc + inverted light glyph. (The img filter lives in app.scss —
// :global + nesting here once compiled to a page-level body filter.)

.overlay-side-icons {
  display: flex;
  flex-direction: column;
  min-width: 22px;
  /* border-left: 2px solid rgba(color('primary', 200), 0.4); */
}

.overlay-icon-btn {
  height: 10px;
  width: 22px;
  padding: 0;
  margin: 0;
  transform: translateX(-2px);
  border-radius: 100px;
  background-color: transparent;
  transition:
    color 0.2s,
    background-color 0.2s;

  // Icon sits directly on the light basemap: dark glyph in BOTH themes
  // (corrected zones rule); no background in any state. Active = gold.
  .q-icon,
  &.q-btn :deep(.q-icon) {
    color: #1c1c1c !important;
  }

  &:hover {
    background-color: rgba(0, 0, 0, 0.08);
    .q-icon {
      color: #1c1c1c !important;
    }
  }

  &.active {
    color: #bfab25;
    .q-icon {
      color: #bfab25 !important;
    }
  }
}

.filter-badge {
  position: absolute;
  top: 3px;
  right: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--q-primary);
}
</style>

<template>
  <div :class="['overlay-switch-item']">
    <!-- Main overlay icon/button -->
    <q-btn
      fab-mini
      flat
      dense
      class="overlay-main-btn"
      :class="{ active }"
      :aria-label="label"
      @click="onMainClick"
      :ripple="false"
    >
      <q-icon :name="icon" size="24px" />
    </q-btn>

    <!-- Side icons (info and filter) -->
    <div v-if="hasInfo || hasFilters" class="overlay-side-icons">
      <q-btn
        v-if="hasInfo && active"
        flat
        dense
        icon="wd-info-outline"
        class="overlay-icon-btn"
        size="xs"
        :class="{ active: isInfoActive }"
        :aria-label="`${label} info`"
        @click="onInfoClick"
      >
      </q-btn>

      <q-btn
        v-if="hasFilters && active"
        flat
        dense
        :icon="showBadge ? 'wd-filter' : 'wd-filter-outline'"
        size="xs"
        class="overlay-icon-btn"
        :class="{ active: isFilterActive }"
        :aria-label="`${label} filter`"
        @click="onFilterClick"
      >
        <div v-if="showBadge" class="filter-badge"></div>
      </q-btn>
    </div>
  </div>
</template>
