<script setup lang="ts">
import { computed } from 'vue';
import { schemasWodore } from '@clients/index';
import getImageUrl from '@services/imageService';

interface Props {
  type:
    | schemasWodore['HutSchemaDetails']['type_open']
    | schemasWodore['HutSchemaDetails']['type_open'];
  name: string;
  color?: string;
  color2?: string;
}
const props = withDefaults(defineProps<Props>(), {
  color: 'white',
});

const color_bg = computed(() => (props.color2 ? props.color2 : 'white'));
</script>
<style scoped></style>
<template>
  <q-chip
    size="md"
    v-if="type && type.name"
    :class="'bg-' + color_bg + ' q-mr-none'"
    style="min-width: 40px; max-width: 200px; max-height: 30px"
  >
    <q-avatar :class="'bg-' + color" text-color="white">
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
    <span class="text-primary-900">{{ name }}</span>
    <slot></slot>
  </q-chip>
</template>
