<script setup lang="ts">
import { useRouter } from 'vue-router';

//import { useQuasar } from 'quasar';
//const $q = useQuasar();
const router = useRouter();

function toggleModel() {
  router.push({ name: 'support' });
}
</script>

<template>
  <WdToolbarButton
    icon="wd-gift"
    @click="toggleModel"
    aria-label="Sende Feedback"
  >
    <!-- <q-tooltip v-if="!$q.screen.xs" anchor="center left" self="center right"
      >Kontakt</q-tooltip
    > -->
  </WdToolbarButton>
</template>
