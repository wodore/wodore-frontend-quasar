<script setup lang="ts">
import { ref, defineOptions } from 'vue';

defineOptions({
  name: 'WdPlaceTitleStory',
});

// Note: WdPlaceTitle component depends on backend data via usePlace composable
// For Histoire, we show mock implementations of the rendered output
const placeName = ref('Schreckhornhütte SAC');
const placeUrl = ref('https://www.sac-basel.ch/schreckhornhuette');
</script>

<template>
  <Story title="Content/WdPlaceTitle" :layout="{ type: 'single', iframe: false }">
    <template #controls>
      <HstText v-model="placeName" title="Place Name" />
      <HstText v-model="placeUrl" title="Place URL" />
    </template>

    <Variant title="Component Info" id="info">
      <div class="bg-grey-2 q-pa-md" style="max-width: 600px">
        <div class="text-h6 q-mb-sm">WdPlaceTitle Component</div>
        <p class="text-body2">
          <strong>Location:</strong> <code>src/components/content/place/WdPlaceTitle.vue</code>
        </p>
        <p class="text-body2"><strong>Props:</strong> <code>slug: string</code></p>
        <p class="text-body2">
          <strong>Description:</strong> Displays a place title with optional external link and
          weather selector. Fetches place data from the backend using the <code>usePlace</code>
          composable.
        </p>
        <q-separator class="q-my-md" />
        <p class="text-caption text-grey-7">
          <strong>Note:</strong> This component requires backend connectivity and cannot be
          demonstrated in Histoire without mocking. The examples below show the expected rendered
          output.
        </p>
      </div>
    </Variant>

    <Variant title="Desktop with Link" id="desktop-link">
      <div class="bg-white q-pa-md" style="max-width: 600px">
        <q-toolbar style="background-color: unset">
          <q-toolbar-title
            style="text-wrap: wrap; transform: translateY(4px); margin-left: 3px"
            class="text-primary-900"
          >
            <div class="text-h5 q-ma-none q-mt-xs" style="position: relative; padding-right: 52px">
              <a
                :href="placeUrl"
                target="_blank"
                class="text-primary-900"
                style="text-decoration: none"
              >
                {{ placeName }}
                <q-icon size="11pt" style="transform: translateY(-6px)" name="open_in_new" />
              </a>
            </div>
          </q-toolbar-title>
        </q-toolbar>
        <q-separator class="q-my-md" />
        <p class="text-caption text-grey-7">
          Desktop view (text-h5) with external link icon. Edit the name and URL in the controls
          panel.
        </p>
      </div>
    </Variant>

    <Variant title="Mobile with Link" id="mobile-link">
      <div class="bg-white q-pa-md" style="max-width: 360px">
        <q-toolbar style="background-color: unset">
          <q-toolbar-title
            style="text-wrap: wrap; transform: translateY(4px); margin-left: 3px"
            class="text-primary-900"
          >
            <div class="text-h6 q-ma-none q-mt-xs" style="position: relative; padding-right: 52px">
              <a
                :href="placeUrl"
                target="_blank"
                class="text-primary-900"
                style="text-decoration: none"
              >
                {{ placeName }}
                <q-icon size="11pt" style="transform: translateY(-6px)" name="open_in_new" />
              </a>
            </div>
          </q-toolbar-title>
        </q-toolbar>
        <q-separator class="q-my-md" />
        <p class="text-caption text-grey-7">
          Mobile view (text-h6) - smaller heading size for mobile screens.
        </p>
      </div>
    </Variant>

    <Variant title="Long Name (Mobile)" id="long-name">
      <div class="bg-white q-pa-md" style="max-width: 360px">
        <q-toolbar style="background-color: unset">
          <q-toolbar-title
            style="text-wrap: wrap; transform: translateY(4px); margin-left: 3px"
            class="text-primary-900"
          >
            <div class="text-h6 q-ma-none q-mt-xs" style="position: relative; padding-right: 52px">
              <span>Capanna Cristallina CAS (Rifugio Cristallina)</span>
            </div>
          </q-toolbar-title>
        </q-toolbar>
        <q-separator class="q-my-md" />
        <p class="text-caption text-grey-7">Long names wrap properly with proper spacing.</p>
      </div>
    </Variant>

    <Variant title="Without Link" id="no-link">
      <div class="bg-white q-pa-md" style="max-width: 400px">
        <q-toolbar style="background-color: unset">
          <q-toolbar-title
            style="text-wrap: wrap; transform: translateY(4px); margin-left: 3px"
            class="text-primary-900"
          >
            <div class="text-h5 q-ma-none q-mt-xs" style="position: relative; padding-right: 52px">
              <span>Monte Rosa Hütte SAC</span>
            </div>
          </q-toolbar-title>
        </q-toolbar>
        <q-separator class="q-my-md" />
        <p class="text-caption text-grey-7">
          When place.url is not provided, the title is rendered as plain text.
        </p>
      </div>
    </Variant>
  </Story>
</template>
