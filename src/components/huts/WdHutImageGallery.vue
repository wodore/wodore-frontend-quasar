<script setup lang="ts">
import { computed } from 'vue';
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
</script>

<template>
  <!-- Generic Media Preview with hut-specific configuration -->
  <WdMediaPreview
    :images="images"
    :loading="loading"
    :add-image-url="mapCompleteUrl"
    empty-state-message="No images available for this hut"
    :empty-state-icon="IconAddPhoto"
    :osm-id="(hut as any)?.osm_id || null"
  />
</template>
