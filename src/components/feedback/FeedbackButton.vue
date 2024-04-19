<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import ToolbarButton from 'components/toolbar/ToolbarButton.vue';
const $q = useQuasar();
const router = useRouter();

function toggleModel() {
  router.push({ name: 'feedback' });
}
</script>

<template>
  <ToolbarButton
    icon="eva-message-square"
    @click="toggleModel"
    aria-label="Open feedback form"
  >
    <q-tooltip v-if="!$q.screen.xs" anchor="center left" self="center right"
      >Send feedback.</q-tooltip
    >
  </ToolbarButton>
</template>
