<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

function toggleModel() {
  router.push({ name: 'contribute' });
}
</script>

<template>
  <WdToolbarButton icon="wd-camera" @click="toggleModel" aria-label="Contribute"> </WdToolbarButton>
</template>
