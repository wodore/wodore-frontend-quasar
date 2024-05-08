<script setup lang="ts">
interface Props {
  label: string;
  img: string;
  active?: boolean | undefined;
  tooltip?: boolean | undefined;
}
defineProps<Props>();
</script>

<template>
  <q-btn
    round
    style="padding: 0"
    :ripple="false"
    :color="active ? 'accent-500' : 'primary-400'"
  >
    <q-avatar size="55px">
      <img style="padding: 3px" :src="img" />
    </q-avatar>
    <q-tooltip v-if="tooltip"> {{ label }} </q-tooltip>
  </q-btn>
</template>
