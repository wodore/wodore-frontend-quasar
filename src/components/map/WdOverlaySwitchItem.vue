<script setup lang="ts">
import { computed } from 'vue';
import { overlayConfigs } from '@stores/map/overlay-configs';

interface Props {
  label: string;
  icon: string;
  active?: boolean | undefined;
  tooltip?: boolean | undefined;
  overlayName: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  configure: [];
}>();

const hasConfig = computed(() => {
  const config = overlayConfigs[props.overlayName];
  return !!(config?.filters || config?.settings || config?.legend);
});

function onLongPress() {
  if (hasConfig.value) {
    emit('configure');
  }
}
</script>

<style lang="scss" scoped>
.icon-inactive {
  opacity: 0.6;
}
.icon-active {
  opacity: 0.8;
}

.config-icon {
  opacity: 0;
  transition: opacity 0.2s;
  background: rgba(255, 255, 255, 0.9);
}

.overlay-switch-btn:hover .config-icon {
  opacity: 1;
}
</style>

<template>
  <q-btn
    fab-mini
    round
    class="overlay-switch-btn"
    style="padding: 0; position: relative"
    :ripple="false"
    :color="active ? 'accent-200' : 'icon'"
    v-touch-hold:1500.mouse="onLongPress"
  >
    <q-icon :name="icon" :class="{ 'icon-active': active, 'icon-inactive': !active }" />

    <!-- Config icons removed - will be added outside button in parent component -->

    <!-- <q-tooltip v-if="tooltip"> {{ label }} </q-tooltip> -->
  </q-btn>
</template>
