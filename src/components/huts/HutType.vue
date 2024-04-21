<script setup lang="ts">
import { computed, defineProps, withDefaults } from 'vue';

import { schemasWodore } from 'src/clients';

interface Props {
  type?:
    | schemasWodore['HutSchemaDetails']['type_open']
    | schemasWodore['HutSchemaDetails']['type_open'];
  capacity?:
    | schemasWodore['HutSchemaDetails']['capacity_open']
    | schemasWodore['HutSchemaDetails']['capacity_closed'];
  color?: string;
  open?: boolean | undefined | null;
}
const props = withDefaults(defineProps<Props>(), {
  color: 'white',
  open: undefined,
});

const openIcon = computed(() => {
  return props.open
    ? 'wd-checkmark'
    : props.open == false
      ? 'wd-close'
      : 'wd-question-mark';
});

const openColor = computed(() => {
  return props.open ? 'green-6' : props.open == false ? 'red-4' : 'grey-6';
});
</script>
<style lang="scss" scoped>
.content {
  border-radius: 25px;
  max-width: 125px;
  min-width: 125px;
  min-height: 55px;
  max-height: 55px;
  text-wrap: pretty;
}
.badge {
  border-radius: 25px;
}
</style>
<template>
  <div
    :class="['bg-' + color, 'q-pa-sm', 'row content', 'items-center']"
    v-if="type || (capacity && capacity > 0)"
  >
    <q-icon v-if="type" :name="'img:' + type.symbol" size="38px" />
    <div class="col q-ml-sm">
      <div :class="['text-h5', 'text-accent-700']" style="font-weight: 500">
        {{ capacity !== null ? capacity : '?' }}
      </div>
      <!-- <div class="text-caption text-dark-100" style="margin-top: -7px">
        {{ type?.name }}
      </div> -->
    </div>

    <q-icon
      :class="'bg-' + openColor + ' badge q-mr-xs'"
      color="white"
      :name="openIcon"
      size="16px"
    />
  </div>
</template>
