<script setup lang="ts">
interface Props {
  is: object;
}
defineProps<Props>();
</script>
<template>
  <q-icon>
    <component :is="is" />
  </q-icon>
</template>
