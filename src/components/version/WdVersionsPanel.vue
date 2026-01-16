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
    const { data, error } = await clientWodore.GET('/v1/version');

    if (error) {
      throw new Error(JSON.stringify(error));
    }

    if (data) {
      backendVersion.value = data.version || '';
      backendHash.value = data.hash || '';
    }
  } catch (err) {
    backendError.value =
      err instanceof Error ? err.message : 'Failed to fetch backend version';
    console.error('Failed to fetch backend version:', err);
  } finally {
    backendLoading.value = false;
  }
};

onMounted(fetchBackendVersion);
</script>

<template>
  <div class="column q-gutter-xs shadow-1 q-pb-sm q-pl-xs">
    <WdVersionTag
      type="frontend"
      :version="frontendVersion"
      :hash="frontendHash"
    >
    </WdVersionTag>
    <WdVersionTag
      type="backend"
      :version="backendVersion"
      :hash="backendHash"
      :loading="backendLoading"
      :error="backendError"
    />
  </div>
</template>
