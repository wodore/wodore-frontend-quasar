<script setup lang="ts">
import { computed } from 'vue';

import track from '@services/analytics';
//import { computed } from 'vue';
//import { useQuasar } from 'quasar';
//const model = defineModel();

interface Props {
  //stripeId: string;
  name: string;
  amount?: string;
  icon?: string;
  sizeFactor?: number;
}

withDefaults(defineProps<Props>(), { sizeFactor: 1 });

function trackClick(product: string) {
  track('support-stripe', { product: product });
}

const stripeId = process.env['STRIPE_ID'];

const link = computed(() => {
  return 'https://donate.stripe.com/' + stripeId + '?locale=de';
});
</script>

<template>
  <q-btn
    :href="link"
    @click="trackClick(name.toLocaleLowerCase())"
    @click.middle="trackClick(name.toLocaleLowerCase())"
    target="_blank"
    no-caps
    style="text-transform: unset"
  >
    <div class="q-py-md row justify-center">
      <q-icon
        :style="
          'height: ' + 40 * sizeFactor + 'px; width: ' + 40 * sizeFactor + 'px'
        "
        style="filter: invert()"
        :name="'img:products/' + icon + '.png'"
        class="col-12"
      />
      <div
        class="q-py-lg col-12"
        :class="{
          'text-white': sizeFactor <= 1,
          'text-accent-200': sizeFactor > 1,
        }"
        :style="
          'font-size: ' +
          15 * (sizeFactor > 1 ? sizeFactor + (sizeFactor - 1) / 8 : 1) +
          'pt;'
        "
      >
        {{ name }}
      </div>
      <div v-if="amount" class="text-caption text-primary-200 col-12">
        <span class="text-body2">{{ amount }}</span> CHF<br />
        pro Monat*
      </div>
    </div>
  </q-btn>
</template>
