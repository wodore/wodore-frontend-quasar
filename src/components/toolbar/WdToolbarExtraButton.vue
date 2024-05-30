<script setup lang="ts">
interface Props {
  icon: string;
  iconColor?: string;
  disabled?: boolean;
}
withDefaults(defineProps<Props>(), {
  iconColor: 'primary-800',
  disabled: false,
});
</script>

<template>
  <q-item
    :clickable="!disabled"
    v-ripple
    :style="disabled ? 'opacity : 0.5;' : ''"
  >
    <q-item-section avatar style="min-width: 34px; padding-right: 0">
      <q-icon :color="iconColor" :name="icon" />
    </q-item-section>
    <q-item-section> <slot /></q-item-section>
  </q-item>
</template>
