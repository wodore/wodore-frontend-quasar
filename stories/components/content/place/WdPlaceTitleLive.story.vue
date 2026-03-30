<script setup lang="ts">
import { ref, computed, defineOptions } from 'vue';
import WdPlaceTitle from '@components/content/place/WdPlaceTitle.vue';

defineOptions({
  name: 'WdPlaceTitleLiveStory',
});

// Available place slugs (you can find these in your backend)
const availableSlugs = [
  'aarbiwak',
  'britannia',
  'monte-rosa',
  'arben',
  'barroud',
  'alp-de-fora',
  'baita-valmaggia',
];

const selectedSlug = ref('aarbiwak');
const customSlug = ref('');
const useCustomSlug = ref(false);

// Computed slug to use
const currentSlug = computed(() => {
  return useCustomSlug.value ? customSlug.value : selectedSlug.value;
});
</script>

<template>
  <Story
    title="Content/WdPlaceTitle (Live)"
    :layout="{ type: 'single', iframe: false }"
    auto-props-disabled
  >
    <template #controls>
      <HstCheckbox v-model="useCustomSlug" title="Use Custom Slug" />
      <HstSelect
        v-if="!useCustomSlug"
        v-model="selectedSlug"
        title="Select Place"
        :options="availableSlugs"
      />
      <HstText v-if="useCustomSlug" v-model="customSlug" title="Custom Slug" />
    </template>

    <Variant title="Live Component">
      <div class="bg-grey-2 q-pa-sm q-mb-md" style="max-width: 700px">
        <div class="text-caption">
          <strong>ℹ️ Live Backend Connection</strong><br />
          This story loads the actual WdPlaceTitle component with real backend data.<br />
          <strong>Current Slug:</strong> <code>{{ currentSlug }}</code>
        </div>
      </div>

      <div class="bg-white q-pa-md" style="max-width: 700px; min-height: 100px">
        <WdPlaceTitle :slug="currentSlug" />

        <q-separator class="q-my-md" />

        <div class="text-caption text-grey-7">
          <strong>How it works:</strong>
          <ul class="q-my-sm">
            <li>Component calls <code>usePlace(slug)</code> composable</li>
            <li>Composable fetches data from backend API</li>
            <li>Component renders with real data (name, URL, weather)</li>
          </ul>
          <strong>Requirements:</strong>
          <ul class="q-my-sm">
            <li>Backend must be running at the configured API URL</li>
            <li>The slug must exist in the database</li>
            <li>Network connectivity required</li>
          </ul>
        </div>
      </div>
    </Variant>

    <Variant title="Error Handling">
      <div class="bg-white q-pa-md" style="max-width: 700px">
        <q-banner class="bg-warning text-white q-mb-md">
          <template #avatar>
            <q-icon name="warning" />
          </template>
          <div>
            <strong>Testing Error States:</strong><br />
            Try entering an invalid slug in the custom slug field to see error handling.
          </div>
        </q-banner>

        <div class="text-body2">
          <p><strong>Common scenarios to test:</strong></p>
          <ul>
            <li><strong>Invalid slug:</strong> Enter "nonexistent-place"</li>
            <li><strong>Backend down:</strong> Stop your backend server</li>
            <li><strong>Network issues:</strong> Disconnect internet</li>
            <li><strong>Slow connection:</strong> Throttle network in DevTools</li>
          </ul>
        </div>

        <q-separator class="q-my-md" />

        <div class="text-caption text-grey-7">
          The component should gracefully handle errors and show appropriate feedback to users.
        </div>
      </div>
    </Variant>

    <Variant title="Multiple Places">
      <div class="bg-white q-pa-md" style="max-width: 700px">
        <div class="text-h6 q-mb-md">Compare Multiple Places</div>

        <div v-for="slug in availableSlugs.slice(0, 3)" :key="slug" class="q-mb-lg">
          <div class="text-caption text-grey-7 q-mb-xs">
            <code>{{ slug }}</code>
          </div>
          <WdPlaceTitle :slug="slug" />
          <q-separator class="q-mt-sm" />
        </div>

        <div class="text-caption text-grey-7">
          Showing multiple instances with different slugs to compare layouts and styling.
        </div>
      </div>
    </Variant>
  </Story>
</template>
