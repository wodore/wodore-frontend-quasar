<script setup lang="ts">
import { defineProps, withDefaults } from 'vue';

import { schemasWodore } from 'src/clients';

interface Props {
  hut?: schemasWodore['HutSchemaDetails'];
  round?: boolean;
  flat?: boolean;
  padding?: string;
  color?: string;
  target?: string;
}
const props = withDefaults(defineProps<Props>(), {
  round: true,
  flat: true,
  padding: 'xs',
  target: '_blank',
});
</script>
<style lang="scss" scoped>
.content {
  border-radius: 20px;
  padding: 4px;
  margin: 5px;
  margin-bottom: 20px;
  width: fit-content;
  max-width: fit-content;
  background-color: rgba($white, 0.7) !important;
}
</style>
<template>
  <div class="content justify-start row" :class="{ column: $q.screen.gt.xs }">
    <div :key="ref.name" v-for="ref in props.hut?.sources" class="col">
      <q-btn
        :href="ref.link"
        :target="props.target"
        :flat="props.flat"
        :padding="props.padding"
        :round="props.round"
        :color="props.color"
      >
        <!--{{ ref.slug }}-->
        <img
          :style="{ height: $q.platform.is.mobile ? '30px' : '20px' }"
          :src="ref.logo"
        />
        <q-tooltip :hide-delay="150" :delay="150">
          <span>{{ ref.fullname }}</span
          ><br />
          <!-- TODO: send id -->
          <span class="text-bold text-subtitle1">{{ ref.slug }}</span>
        </q-tooltip>
      </q-btn>
    </div>
  </div>
</template>
