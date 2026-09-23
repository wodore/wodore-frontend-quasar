<script setup lang="ts">
interface Props {
  icon?: string;
  color?: string;
  size?: string;
  active?: boolean;
}

withDefaults(defineProps<Props>(), {
  icon: 'wd-menu',
  color: undefined,
  size: 'lg',
  active: false,
});
</script>

<template>
  <q-btn
    flat
    dense
    round
    :size="size"
    :icon="icon"
    :color="color"
    class="wd-toolbar-btn"
    :class="{ 'wd-toolbar-btn--active': active }"
    ><slot />
  </q-btn>
</template>
