<script setup lang="ts">
import { computed, inject, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import type { HutImage } from '@composables/useHutImages';
import type { schemasWodore } from '@clients/index';
import WdMediaPreview from '../media/WdMediaPreview.vue';
import IconAddPhoto from '~icons/material-symbols/add-a-photo.svg';

const $q = useQuasar();
const router = useRouter();
const { t } = useI18n();

interface Props {
  images: HutImage[];
  loading?: boolean;
  hut?: schemasWodore['HutSchemaDetails'];
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

// Responsive icon size
const iconSize = computed(() => ($q.screen.xs ? '24px' : '32px'));

// Panel context: while the desktop content panel is MINIMIZED the gallery
// renders its mobile stripe; maximized/desktop shows the 3:2 gallery.
// The same stripe view applies to genuinely narrow windows: below md
// (770px) the app renders the bottom sheet, which must show the mobile
// stripe too (owner 2026-10: the old rule keyed off xs, not width).
const panelMinimized = inject<Ref<boolean> | null>('wdContentPanelMinimized', null);
const mobileStripeView = computed(() => $q.screen.lt.md || panelMinimized?.value === true);
const gallerySlotClass = computed(() =>
  mobileStripeView.value
    ? 'wd-gallery-slot wd-gallery-slot--stripe'
    : 'wd-gallery-slot wd-gallery-slot--full'
);

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

  // Add context reference to show tip banner
  query.c_ref = 'hut';

  router.push({
    name: 'contribute',
    query,
  });
};
</script>

<template>
  <!-- Reserved gallery slot (owner 2026-10): the wrapper ALWAYS occupies
       the final gallery height — desktop 3:2 (aspect-locked like
       .media-preview-wrapper) or the mobile stripe's fixed 87px — so
       loading→loaded and images→no-images transitions never change the
       layout. Skeleton tint while loading; the gallery/no-image content
       fills the box otherwise. -->
  <div :class="gallerySlotClass">
    <!-- Loading (no images resolved yet): skeleton in the exact final
         shape — no size toggle once data lands -->
    <div v-if="loading && images.length === 0" class="wd-gallery-skeleton" aria-hidden="true">
      <q-iconify :is="IconAddPhoto" :size="iconSize" />
    </div>

    <!-- With images: show contribute button overlay (desktop gallery view
         only — hidden in the minimized stripe and narrow/mobile views,
         owner 2026-10) -->
    <div v-else-if="images.length > 0" class="image-gallery-container">
      <q-btn
        v-if="!mobileStripeView"
        flat
        dense
        round
        :ripple="false"
        class="contribute-btn-overlay"
        color="grey-7"
        :aria-label="t('contribute.contribute_images')"
        @click="handleContributeClick"
      >
        <q-iconify :is="IconAddPhoto" :size="iconSize" />
      </q-btn>

      <WdMediaPreview
        class="gallery-media-preview"
        :images="images"
        :loading="loading"
        :add-image-url="mapCompleteUrl"
        :empty-state-message="$t('media.no_images')"
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

    <!-- Without images: media preview in the SAME reserved box (its
         no-image state renders WdNoImage inside) -->
    <WdMediaPreview
      v-else
      class="gallery-media-preview"
      :images="images"
      :loading="loading"
      :add-image-url="mapCompleteUrl"
      :empty-state-message="$t('media.no_images_for_hut')"
      :empty-state-icon="IconAddPhoto"
      :osm-feature="osmFeature"
      :osm-id-only="osmIdOnly"
      :osm-id="osmId"
      :refuges-id="refugesId"
      :mapcomplete-theme="'theme'"
      :mapcomplete-userlayout="'https%3A%2F%2Fstudio.mapcomplete.org%2F2805144%2Flayers%2Fhuts_and_shelters%2Fhuts_and_shelters.json'"
      :hut-lat="hut?.location?.lat ?? null"
      :hut-lon="hut?.location?.lon ?? null"
      :reduced-height-no-image="true"
    />
  </div>
</template>

<style lang="scss" scoped>
// ── Reserved slot heights (owner 2026-10 anti-flicker pass). The desktop
//    variant mirrors WdMediaPreview's .media-preview-wrapper 3:2
//    padding-top box (height follows width deterministically); the
//    stripe variant is the fixed mobile-stripe height (85px + margin).
.wd-gallery-slot--full {
  position: relative;
  width: 100%;
  padding-top: 66.67%; // 3:2 — same box the gallery renders into
  margin-bottom: 8px;

  > :not(.wd-gallery-skeleton) {
    position: absolute;
    inset: 0;
  }
}

.wd-gallery-slot--stripe {
  position: relative;
  height: 95px; // mobile stripe (85) + spacing — fixed box

  > :not(.wd-gallery-skeleton) {
    position: absolute;
    inset: 0;
  }
}

.wd-gallery-skeleton {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(var(--wd-ink-rgb), 0.05);
  color: rgba(var(--wd-ink-rgb), 0.4);
}

.image-gallery-container {
  position: relative;
  height: 100%;
}

// On mobile no margin so stripe and button align flush to the container edge
.gallery-media-preview {
  margin: 8px;
}

// Inside the reserved slot the media preview is absolutely positioned —
// its flow-era margins OFFSET the box instead of spacing it (image sat
// 16px right of center, owner report 2026-10). Zero them for BOTH
// branches (with/without images); the slot owns the geometry.
.wd-gallery-slot .gallery-media-preview {
  margin: 0;
}

@media (min-width: 1024px) {
  .gallery-media-preview {
    margin: 16px;
  }
}

@media (max-width: 599px) {
  .gallery-media-preview {
    margin: 0;
  }
}

.contribute-btn-overlay {
  position: absolute;
  top: 2px;
  left: 2px;
  z-index: 10;
  padding: 8px;
  border-radius: 50%;

  @media (min-width: 600px) {
    top: 5px;
    left: 12px;
  }
}

.contribute-btn-overlay :deep(.q-iconify) {
  filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.8))
    drop-shadow(0 0 2px rgba(255, 255, 255, 0.6));
  transition:
    transform 0.2s ease,
    filter 0.2s ease;
}

.contribute-btn-overlay:hover {
  color: var(--q-color-grey-9);
}

.contribute-btn-overlay:hover :deep(.q-iconify) {
  transform: scale(1.2);
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.9))
    drop-shadow(0 0 2px rgba(255, 255, 255, 0.7));
}

.contribute-btn-overlay:focus-visible {
  outline: 2px solid var(--q-color-primary);
  outline-offset: 2px;
}
</style>
