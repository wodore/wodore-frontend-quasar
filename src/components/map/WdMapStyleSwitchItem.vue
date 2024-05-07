<script setup lang="ts">
import { StyleSwitchItem } from './styles';

interface Props {
  item: StyleSwitchItem;
}
defineProps<Props>();
</script>

<template>
  <q-btn
    round
    style="padding: 0"
    :ripple="false"
    :color="item.active ? 'accent-500' : 'primary-400'"
  >
    <q-avatar size="55px">
      <img style="padding: 3px" :src="item.img" />
    </q-avatar>
    <q-tooltip v-if="$q.platform.is.desktop"> {{ item.label }} </q-tooltip>
  </q-btn>
</template>
