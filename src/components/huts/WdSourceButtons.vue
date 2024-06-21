<script setup lang="ts">
import { withDefaults } from 'vue';

import getImageUrl from '@services/imageService';
import { useAuthStore } from '@stores/auth-store';
const authStore = useAuthStore();

import { schemasWodore } from '@clients/index';
import track from '@services/analytics';

interface Props {
  hut?: schemasWodore['HutSchemaDetails'] | null;
  round?: boolean;
  flat?: boolean;
  background?: boolean;
  padding?: string;
  color?: string;
  target?: string;
}
const props = withDefaults(defineProps<Props>(), {
  round: true,
  flat: true,
  background: false,
  padding: 'xs',
  target: '_blank',
});
function trackSource(slug: string) {
  track('hut-source-' + props.hut?.slug, { slug: slug });
}
</script>
<style lang="scss" scoped>
.content {
  border-radius: 20px;
  padding: 4px;
  //margin: 5px;
  //margin-bottom: 20px;
  width: fit-content;
  max-width: fit-content;
  background-color: rgba($white, 0.7) !important;
}
</style>
<template>
  <div v-if="hut" class="justify-start row" :class="{ content: background }">
    <div :key="ref.name" v-for="ref in props.hut?.sources" class="col">
      <q-btn
        :href="ref.link"
        @click="trackSource(ref.slug)"
        @click.middle="trackSource(ref.slug)"
        :target="props.target"
        :flat="props.flat"
        :padding="props.padding"
        :round="props.round"
        :color="props.color"
        v-if="ref.public || authStore.isAdmin()"
        style="min-width: 44px"
      >
        <!--{{ ref.slug }}-->
        <img
          :style="{ height: $q.platform.is.mobile ? '24px' : '24px' }"
          :src="
            getImageUrl(ref.logo, { fit: true, size: '48x48', quality: 90 })
          "
        />
        <q-tooltip :hide-delay="150" :delay="150">
          <span>{{ ref.fullname }}</span
          ><br />
          <b>{{ ref.source_id }}</b>
          <!-- <br /> -->
          <!-- TODO: send id -->
          <!-- <span class="text-bold text-subtitle1">{{ ref.slug }}</span> -->
        </q-tooltip>
      </q-btn>
    </div>
  </div>
</template>
