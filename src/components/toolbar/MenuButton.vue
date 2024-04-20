<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import ToolbarButton from 'components/toolbar/ToolbarButton.vue';
const model = defineModel();

interface Props {
  side?: 'left' | 'right';
  function?: 'open' | 'close' | 'both';
  mobile?: boolean;
  desktop?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  side: 'left',
  function: 'both',
  mobile: false,
  desktop: false,
});

const $q = useQuasar();

const isMobile = computed(() => {
  return $q.screen.xs;
});
const menuBtnColor = computed(() => {
  return model.value ? 'primary-300' : 'primary-100';
});
const menuArialLabel = computed(() => {
  return model.value ? 'close menu' : 'open menu';
});

const menuIconOpen = 'eva-menu-outline';
const menuIconClose = 'eva-menu-arrow';
const menuBtnIcon = computed(() => {
  if (props.function == 'open') {
    return menuIconOpen;
  } else if (props.function == 'close') {
    return menuIconClose;
  }
  return model.value ? menuIconClose : menuIconOpen;
});

const showMenu = computed(() => {
  if (!props.mobile && !props.desktop) {
    // no props is given, show allways
    return true;
  } else if (props.mobile && isMobile.value) {
    return true;
  } else if (props.desktop && !isMobile.value) {
    return true;
  }
  return false;
});
</script>

<template>
  <ToolbarButton
    v-if="showMenu"
    :color="menuBtnColor"
    :icon="menuBtnIcon"
    :class="{ 'rotate-180': props.side == 'right' }"
    :aria-label="menuArialLabel"
    @click="model = !model"
  >
  </ToolbarButton>
</template>
