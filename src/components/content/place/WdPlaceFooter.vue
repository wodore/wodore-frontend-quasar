<script setup lang="ts">
import { computed } from 'vue';
import { usePlace } from '@composables/usePlace';
import WdSourceButtons from '@components/huts/WdSourceButtons.vue';

interface Props {
  slug?: string;
}

const props = defineProps<Props>();

// Fetch place data for footer
const { place } = usePlace(computed(() => props.slug));
</script>

<style scoped>
.footer-toolbar {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}
</style>

<template>
  <q-toolbar class="footer-toolbar bg-white">
    <WdSourceButtons v-if="place" :hut="place" />
  </q-toolbar>
</template>
