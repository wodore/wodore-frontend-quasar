<script setup lang="ts">
import { computed } from 'vue';
import track from '@services/analytics';

//import { computed } from 'vue';
//import { useQuasar } from 'quasar';
//const model = defineModel();

interface Props {
  stripeId: string;
  name: string;
  amount?: string;
  icon?: string;
}

function trackClick(product: string) {
  track('support-stripe', { product: product });
}
const props = withDefaults(defineProps<Props>(), {});

const link = computed(() => {
  return 'https://donate.stripe.com/' + props.stripeId + '?locale=de';
});
</script>

<template>
  <a
    :href="link"
    target="_blank"
    @click="trackClick(name.toLocaleLowerCase())"
    @click.middle="trackClick(name.toLocaleLowerCase())"
    >{{ name }}
    <q-icon
      v-if="icon"
      :name="'img:products/' + icon + '.png'"
      style="opacity: 0.6"
    />
  </a>

  <!-- <q-btn :href="link" target="_blank" no-caps style="text-transform: unset">
    <q-icon v-if="icon" :name="'img:products/' + icon + '.png'" />
    <span class="text-dark">
      {{ name }}
    </span>
    <span class="q-pa-xs" />
    <span v-if="amount" class="text-caption text-primary-800">
      {{ amount }}</span
    >
  </q-btn>
   -->
</template>
