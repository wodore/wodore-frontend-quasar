<script setup lang="ts">
import { computed } from 'vue';
import { schemasWodore } from '@clients/index';
import getImageUrl from '@services/imageService';

import IconCheckmarkFill from '~icons/eva/checkmark-fill';
import IconQuestionMarkFill from '~icons/eva/question-mark-fill';
import IconCloseFill from '~icons/eva/close-fill';
//import IconMinusOutline from '~icons/eva/minus-outline';

interface Props {
  type?:
    | schemasWodore['HutSchemaDetails']['type_open']
    | schemasWodore['HutSchemaDetails']['type_open'];
  capacity?:
    | schemasWodore['HutSchemaDetails']['capacity_open']
    | schemasWodore['HutSchemaDetails']['capacity_closed'];
  open?: schemasWodore['AnswerEnum'];
}
const props = withDefaults(defineProps<Props>(), {
  open: undefined,
});

const openIcon = computed(() => {
  switch (props.open) {
    case 'yes':
      return IconCheckmarkFill;
    case 'no':
      return IconCloseFill;
    case 'maybe':
      //return IconMinusOutline;
      return IconQuestionMarkFill;
  }
  return IconQuestionMarkFill;
});

const color_bg = computed(() => {
  switch (props.open) {
    case 'yes':
      return 'positive-200';
    case 'no':
      return 'negative-100';
    case 'maybe':
      return 'primary-100';
  }
  return 'primary-100';
});

const color_bg_avantar = computed(() => {
  switch (props.open) {
    case 'yes':
      return 'positive-400';
    case 'no':
      return 'negative-200';
    case 'maybe':
      return 'primary-200';
  }
  return 'primary-200';
  //return 'grey-4';
});
const openColor = computed(() => {
  switch (props.open) {
    case 'yes':
      return 'positive-600';
    case 'no':
      return 'negative-300';
    case 'maybe':
      return 'primary-400';
  }
  return 'primary-400';
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
    <q-avatar :class="'bg-' + color_bg_avantar" text-color="white">
      <q-icon
        size="24px"
        :name="
          'img:' +
          getImageUrl(
            ($q.platform.is.mobile
              ? type.symbol
              : type.symbol_simple) as string,
            { fit: true, size: '48x48' },
          )
        "
      />
    </q-avatar>
    <!-- style="filter: invert(1)" -->
    <span class="text-accent-900" style="font-weight: 500; width: 28px">{{
      capacity === undefined || capacity == null ? '?' : capacity
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
