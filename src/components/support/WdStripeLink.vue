<script setup lang="ts">
import { computed } from 'vue';

//import { computed } from 'vue';
//import { useQuasar } from 'quasar';
//const model = defineModel();

interface Props {
  stripeId: string;
  name: string;
  amount?: string;
  icon?: string;
}

const props = withDefaults(defineProps<Props>(), {});

const link = computed(() => {
  return 'https://donate.stripe.com/' + props.stripeId + '?locale=de';
});
</script>

<template>
  <a :href="link" target="_blank"
    >{{ name }}
    <q-icon v-if="icon" :name="'img:products/' + icon + '.png'" />
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
