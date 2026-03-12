<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { HutImage } from '@composables/useHutImages';
import type { schemasWodore } from '@clients/index';
import WdMediaPreview from '../media/WdMediaPreview.vue';
import IconAddPhoto from '~icons/material-symbols/add-a-photo.svg';

interface Props {
  images: HutImage[];
  loading?: boolean;
  hut?: schemasWodore['HutSchemaDetails'];
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const router = useRouter();

// Extract OSM link from sources
const osmLink = computed(() => {
  if (!props.hut?.sources) return null;

  const osmSource = props.hut.sources.find(
    source => source.slug?.includes('osm') || source.slug?.includes('openstreetmap')
  );

  return osmSource?.link || null;
});

// Parse OSM link to extract feature and ID
const osmFeatureData = computed(() => {
  const link = osmLink.value;
  if (!link) return null;

  // Extract from URL like: https://www.openstreetmap.org/node/505804029
  const match = link.match(/openstreetmap\.org\/(\w+)\/(\d+)/);
  if (match) {
    return {
      feature: match[1], // node, way, relation
      id: match[2], // the ID
    };
  }

  return null;
});

// Extract OSM feature type (node, way, relation)
const osmFeature = computed(() => osmFeatureData.value?.feature || null);

// Extract OSM ID only (the numeric ID)
const osmIdOnly = computed(() => osmFeatureData.value?.id || null);

// Extract OSM ID from sources (for fallback)
const osmId = computed(() => {
  if (!props.hut?.sources) return null;

  const osmSource = props.hut.sources.find(
    source => source.slug?.includes('osm') || source.slug?.includes('openstreetmap')
  );

  return osmSource?.source_id || null;
});

// Extract Refuges ID from sources
const refugesId = computed(() => {
  if (!props.hut?.sources) return null;

  const refugesSource = props.hut.sources.find(source => source.slug?.includes('refuges'));

  return refugesSource?.source_id || null;
});

// Generate MapComplete URL for adding images
const mapCompleteUrl = computed(() => {
  if (!props.hut?.location) return 'https://github.com/wodore/wodore/issues/new';

  const lat = props.hut.location.lat;
  const lon = props.hut.location.lon;
  if (!lat || !lon) return 'https://github.com/wodore/wodore/issues/new';

  // Check if there's an OSM source
  const hasOsmSource = props.hut.sources?.some(
    source => source.slug?.includes('osm') || source.slug?.includes('openstreetmap')
  );

  const baseUrl = `https://mapcomplete.org/theme.html?z=18&lat=${lat}&lon=${lon}`;

  if (hasOsmSource) {
    // Use mountain_huts theme for existing OSM nodes
    return `${baseUrl}&userlayout=https%3A%2F%2Fstudio.mapcomplete.org%2F2805144%2Fthemes%2Fmountain_huts%2Fmountain_huts.json#node/${props.hut.slug}`;
  } else {
    // Use hotels theme for new points
    return `${baseUrl}&userlayout=https%3A%2F%2Fstudio.mapcomplete.org%2F2805144%2Fthemes%2Fhotels%2Fhotels.json#new_point_dialog_0`;
  }
});

// Handle contribute button click
const handleContributeClick = () => {
  const query: Record<string, string> = {};

  // Add OSM data if available (with c_ prefix)
  if (osmFeatureData.value) {
    query.c_osm_feature = osmFeatureData.value.feature;
    query.c_osm_id_only = osmFeatureData.value.id;
  }

  // Add refuges ID if available (with c_ prefix)
  if (refugesId.value) {
    query.c_refuges_id = refugesId.value;
  }

  // Add coordinates if available (with c_ prefix)
  if (props.hut?.location) {
    query.c_lat = String(props.hut.location.lat);
    query.c_lon = String(props.hut.location.lon);
    query.c_zoom = '15';
  }

  // Add mapcomplete parameters (with c_ prefix)
  query.c_mapcomplete_theme = 'theme';
  query.c_mapcomplete_userlayout =
    'https%3A%2F%2Fstudio.mapcomplete.org%2F2805144%2Flayers%2Fhuts_and_shelters%2Fhuts_and_shelters.json';

  router.push({
    name: 'contribute',
    query,
  });
};
</script>

<template>
  <!-- Contribute button overlay (only show when there are images) -->
  <div v-if="images.length > 0" class="image-gallery-container">
    <q-btn
      flat
      dense
      class="contribute-btn-overlay"
      color="accent-800"
      @click="handleContributeClick"
    >
      <q-iconify :is="IconAddPhoto" size="20px" />
      <q-tooltip>Contribute images</q-tooltip>
    </q-btn>

    <WdMediaPreview
      :images="images"
      :loading="loading"
      :add-image-url="mapCompleteUrl"
      empty-state-message="No images available for this hut"
      :empty-state-icon="IconAddPhoto"
      :osm-feature="osmFeature"
      :osm-id-only="osmIdOnly"
      :osm-id="osmId"
      :refuges-id="refugesId"
      :mapcomplete-theme="'theme'"
      :mapcomplete-userlayout="'https%3A%2F%2Fstudio.mapcomplete.org%2F2805144%2Flayers%2Fhuts_and_shelters%2Fhuts_and_shelters.json'"
      :hut-lat="hut?.location?.lat ?? null"
      :hut-lon="hut?.location?.lon ?? null"
    />
  </div>

  <!-- No images - just show the media preview with empty state -->
  <WdMediaPreview
    v-else
    :images="images"
    :loading="loading"
    :add-image-url="mapCompleteUrl"
    empty-state-message="No images available for this hut"
    :empty-state-icon="IconAddPhoto"
    :osm-feature="osmFeature"
    :osm-id-only="osmIdOnly"
    :osm-id="osmId"
    :refuges-id="refugesId"
    :mapcomplete-theme="'theme'"
    :mapcomplete-userlayout="'https%3A%2F%2Fstudio.mapcomplete.org%2F2805144%2Flayers%2Fhuts_and_shelters%2Fhuts_and_shelters.json'"
    :hut-lat="hut?.location?.lat ?? null"
    :hut-lon="hut?.location?.lon ?? null"
  />
</template>

<style scoped>
.image-gallery-container {
  position: relative;
}

.contribute-btn-overlay {
  position: absolute;
  top: 5px;
  left: 12px;
  z-index: 10;
  padding: 6px;
  border-radius: 8px;
}

.contribute-btn-overlay :deep(.q-iconify) {
  filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.8))
    drop-shadow(0 0 3px rgba(255, 255, 255, 0.5));
}

.contribute-btn-overlay:hover :deep(.q-iconify) {
  filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.9))
    drop-shadow(0 0 4px rgba(255, 255, 255, 0.6));
}
</style>
