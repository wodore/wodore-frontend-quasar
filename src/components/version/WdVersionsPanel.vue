<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { clientWodore } from 'src/clients';
import { PINNED_API_VERSION } from '@services/apiVersion';
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
  padding-bottom: calc(1.5rem + var(--q-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
}
</style>

<template>
  <div class="wd-versions column q-gutter-y-xs q-pb-xl q-px-sm q-mt-md">
    <div class="wd-versions__label wd-ink-soft-text">Build</div>
    <WdVersionTag type="frontend" :version="frontendVersion" :hash="frontendHash"> </WdVersionTag>
    <WdVersionTag
      type="backend"
      :version="backendVersion"
      :hash="backendHash"
      :loading="backendLoading"
      :error="backendError"
    />
    <div class="row items-center no-wrap q-gutter-xs">
      <q-tooltip self="center right" anchor="center right" :delay="1000" :offset="[-5, 0]">
        API version — backend CHANGELOG_API.md
      </q-tooltip>
      <q-icon name="wd-api" size="14px" class="wd-ink-soft-text" />
      <span class="text-caption wd-ink-soft-text">
        <span class="text-weight-medium">
          <a
            target="_blank"
            href="https://github.com/wodore/wodore-backend/blob/main/CHANGELOG_API.md"
            >API {{ PINNED_API_VERSION || '—' }}</a
          >
        </span>
      </span>
    </div>
  </div>
</template>
