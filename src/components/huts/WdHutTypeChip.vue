<script setup lang="ts">
import { computed } from 'vue';
import { schemasWodore } from '@clients/index';

import IconCheckmarkFill from '~icons/eva/checkmark-fill';
import IconQuestionMarkFill from '~icons/eva/question-mark-fill';
import IconCloseFill from '~icons/eva/close-fill';

interface Props {
  type?:
    | schemasWodore['HutSchemaDetails']['type_open']
    | schemasWodore['HutSchemaDetails']['type_open'];
  capacity?:
    | schemasWodore['HutSchemaDetails']['capacity_open']
    | schemasWodore['HutSchemaDetails']['capacity_closed'];
  color?: string;
  color2?: string;
  open?: boolean | undefined | null;
}
const props = withDefaults(defineProps<Props>(), {
  color: 'white',
  open: undefined,
});

const openIcon = computed(() => {
  return props.open
    ? IconCheckmarkFill
    : props.open == false
      ? IconCloseFill
      : IconQuestionMarkFill;
});

const color_bg = computed(() => (props.color2 ? props.color2 : 'white'));

const openColor = computed(() => {
  return props.open ? 'green-6' : props.open == false ? 'red-4' : 'grey-6';
});
</script>
<style scoped>
.badge {
  border-radius: 25px;
}
</style>
<template>
  <q-chip
    size="md"
    v-if="type && type.name"
    :class="'bg-' + color_bg + ' q-mr-none'"
    style="min-width: 90px; max-width: 90px; max-height: 30px"
  >
    <q-avatar :class="'bg-' + color" text-color="white">
      <q-icon
        size="24px"
        :name="
          'img:' + ($q.platform.is.mobile ? type.symbol : type.symbol_simple)
        "
      />
    </q-avatar>
    <!-- style="filter: invert(1)" -->
    <span class="text-accent-900" style="font-weight: 500; width: 28px">{{
      capacity
    }}</span>
    <q-iconify
      :class="'bg-' + openColor + ' badge'"
      color="white"
      size="14px"
      :is="openIcon"
    >
    </q-iconify>
    <!-- <q-badge :color="openColor" floating rounded>
      <q-iconify size="10px" :is="openIcon" />
    </q-badge> -->
    <slot></slot>
  </q-chip>
</template>
