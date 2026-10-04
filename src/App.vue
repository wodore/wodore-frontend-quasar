<script setup lang="ts">
/**
 * Root — global singleton components live here:
 * - WdConfirmPopover: pointer-anchored confirm dialogs (useConfirmPopover)
 */
import WdConfirmPopover from '@components/quasar/WdConfirmPopover.vue';

defineOptions({
  name: 'App',
});
</script>

<template>
  <router-view />
  <WdConfirmPopover />
</template>
