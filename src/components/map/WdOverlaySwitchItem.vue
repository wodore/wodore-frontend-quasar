<script setup lang="ts">
interface Props {
  label: string;
  icon: string;
  active?: boolean | undefined;
  tooltip?: boolean | undefined;
}
defineProps<Props>();
</script>

<style lang="scss" scope>
.icon-inactive {
  opacity: 0.6;
}
.icon-active {
  opacity: 0.8;
}
</style>

<template>
  <!-- style="padding: 0" -->
  <q-btn
    fab-mini
    round
    style="padding: 0"
    :ripple="false"
    :color="active ? 'accent-200' : 'icon'"
  >
    <q-icon
      :name="icon"
      :class="{ 'icon-active': active, 'icon-inactive': !active }"
    />
    <!-- :icon="active ? icon.replace('.svg', '-active.svg') : icon" -->
    <!-- <q-tooltip v-if="tooltip"> {{ label }} </q-tooltip> -->
  </q-btn>
</template>
