<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { clientWodore } from 'src/clients';
import WdVersionTag from './WdVersionTag.vue';

const frontendVersion = process.env.WODORE_APP_VERSION || '';
const frontendHash = process.env.WODORE_GIT_HASH || '';

const backendVersion = ref<string>('');
const backendHash = ref<string>('');
const backendLoading = ref(false);
const backendError = ref<string | null>(null);

const fetchBackendVersion = async () => {
  backendLoading.value = true;
  backendError.value = null;

  try {
    const { data, error } = await clientWodore.GET('/v1/version', {});

    if (error) {
      throw new Error(JSON.stringify(error));
    }

    if (data) {
      backendVersion.value = data.version || '';
      backendHash.value = data.hash_long || '';
    }
  } catch (err) {
    backendError.value = err instanceof Error ? err.message : 'Failed to fetch backend version';
    console.error('Failed to fetch backend version:', err);
  } finally {
    backendLoading.value = false;
  }
};

onMounted(fetchBackendVersion);
</script>

<style scoped>
/* real phones: keep clear of the gesture bar */
:deep(.q-pb-xl),
.column {
  padding-bottom: calc(2rem + env(safe-area-inset-bottom, 0px));
}
</style>

<template>
  <div class="column q-gutter-y-xs q-pb-xl q-px-sm q-mt-md">
    <WdVersionTag type="frontend" :version="frontendVersion" :hash="frontendHash"> </WdVersionTag>
    <WdVersionTag
      type="backend"
      :version="backendVersion"
      :hash="backendHash"
      :loading="backendLoading"
      :error="backendError"
    />
  </div>
</template>
