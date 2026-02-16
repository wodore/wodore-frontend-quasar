<script setup lang="ts">
import { computed } from 'vue';
import { overlayConfigs } from '@stores/map/overlay-configs';
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

const menuStore = useMapMenuStore();

const hasFilters = computed(() => {
  const config = overlayConfigs[props.overlayName];
  return (config?.filters?.length ?? 0) > 0;
});

const hasInfo = computed(() => {
  const config = overlayConfigs[props.overlayName];
  return config?.legend !== undefined;
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
  emit('configure', 'legend');
}

function onFilterClick(event: Event) {
  event.stopPropagation();
  emit('configure', 'filter');
}
</script>

<style lang="scss" scoped>
.overlay-switch-item {
  display: flex;
  align-items: stretch;
  border-radius: 10px;
  overflow: hidden;
  background: color('icon');
  box-shadow: $button-shadow;
  transition: background-color 0.2s;

  &:last-child {
    border-bottom: 3px solid rgba(0, 0, 0, 0.15);
  }
}

.overlay-main-btn {
  height: 40px;
  width: 30px;
  padding: 0;
  margin: 0;
  border-radius: 0;
  transition: background-color 0.2s;

  .q-icon {
    opacity: 0.6;
  }

  &.active {
    background-color: color('accent', 500);

    .q-icon {
      opacity: 1;
      color: white;
    }
  }

  &:hover {
    background-color: rgba(color('white', 500), 0.1);
  }
}

.overlay-side-icons {
  display: flex;
  flex-direction: column;
  border-left: 2px solid rgba(color('primary', 200), 0.4);
}

.overlay-icon-btn {
  height: 10px;
  width: 22px;
  padding: 0;
  margin: 0;
  border-radius: 0;
  background-color: transparent;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(color('white', 500), 0.1);
  }

  &.active {
    background-color: rgba(color('primary', 500), 0.1);
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
      @click="onMainClick"
      :ripple="false"
    >
      <q-icon :name="icon" size="24px" />
    </q-btn>

    <!-- Side icons (info and filter) -->
    <div v-if="hasInfo || hasFilters" class="overlay-side-icons">
      <q-btn
        v-if="hasInfo"
        flat
        dense
        icon="wd-info-outline"
        color="primary"
        class="overlay-icon-btn"
        size="xs"
        :class="{ active: isInfoActive }"
        @click="onInfoClick"
      >
      </q-btn>

      <q-btn
        v-if="hasFilters"
        flat
        dense
        :icon="showBadge ? 'wd-filter' : 'wd-filter-outline'"
        color="primary"
        size="xs"
        class="overlay-icon-btn"
        :class="{ active: isFilterActive }"
        @click="onFilterClick"
      >
        <div v-if="showBadge" class="filter-badge"></div>
      </q-btn>
    </div>
  </div>
</template>
