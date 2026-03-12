<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import getImageUrl from '@services/imageService';
import WdExternalLinkCard from './WdExternalLinkCard.vue';
import track from '@services/analytics';
import type { ExternalLink } from '../../types/contribute';

const $q = useQuasar();
const route = useRoute();

// Parse parameters from hash and query string
const params = computed(() => {
  const hash = route.hash;
  const result: Record<string, string> = {};

  // Parse #p=zoom/lat/lon format from hash
  const pMatch = hash.match(/#p=([^/]+)\/([^/]+)\/([^/]+)/);
  if (pMatch) {
    result.zoom = pMatch[1];
    result.lat = pMatch[2];
    result.lon = pMatch[3];
  }

  // Parse lat/lon from query string (overrides hash if provided) - with c_ prefix
  if (route.query.c_lat) {
    result.lat = String(route.query.c_lat);
  }
  if (route.query.c_lon) {
    result.lon = String(route.query.c_lon);
  }
  if (route.query.c_zoom) {
    result.zoom = String(route.query.c_zoom);
  }

  // Parse osm_id and extract feature type and ID - with c_ prefix
  if (route.query.c_osm_id) {
    const osmId = String(route.query.c_osm_id);
    result.osm_id = osmId;

    // Extract feature type and ID (e.g., "node/123" -> feature: "node", id: "123")
    if (osmId.includes('/')) {
      const [feature, id] = osmId.split('/');
      result.osm_feature = feature;
      result.osm_feature_short = feature.charAt(0).toLowerCase();
      result.osm_id_only = id;
    }
  }

  // Parse osm_feature and osm_id_only directly if provided - with c_ prefix
  if (route.query.c_osm_feature) {
    result.osm_feature = String(route.query.c_osm_feature);
  }
  if (route.query.c_osm_id_only) {
    result.osm_id_only = String(route.query.c_osm_id_only);
    // Build full osm_id if we have both feature and id
    if (result.osm_feature) {
      result.osm_id = `${result.osm_feature}/${result.osm_id_only}`;
    }
  }

  // Parse mapcomplete theme - with c_ prefix
  if (route.query.c_mapcomplete_theme) {
    result.mapcomplete_theme = String(route.query.c_mapcomplete_theme);
  }

  // Parse mapcomplete userlayout - with c_ prefix
  if (route.query.c_mapcomplete_userlayout) {
    result.mapcomplete_userlayout = String(route.query.c_mapcomplete_userlayout);
  }

  // Parse refuges ID - with c_ prefix
  if (route.query.c_refuges_id) {
    result.refuges_id = String(route.query.c_refuges_id);
  }

  // Parse Wikidata ID - with c_ prefix
  if (route.query.c_qid) {
    result.qid = String(route.query.c_qid);
  }

  return result;
});

// Helper function to render template string with params
// Supports ${variable} syntax - if variable is undefined, returns null
const renderTemplate = (template: string, params: Record<string, string>): string | null => {
  let result = template;

  // Handle regular variables: ${variable}
  // If any variable is undefined, return null (this URL is not usable)
  const matches = template.match(/\$\{(\w+)\}/g);
  if (matches) {
    for (const match of matches) {
      const key = match.replace(/\$\{|\}/g, '');
      if (params[key] === undefined) {
        return null; // Variable missing, this URL won't work
      }
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      result = result.replace(regex, params[key]);
    }
  }

  return result;
};

// Define contribution links with translation keys
// Logic and information separated - could be moved to backend later
const contributeLinksData: ExternalLink[] = [
  {
    urls: [
      'https://panoramax.openstreetmap.fr/#map=${zoom}/${lat}/${lon}',
      'https://panoramax.openstreetmap.fr/',
    ],
    nameKey: 'contribute.platforms.panoramax.name',
    descriptionKey: 'contribute.platforms.panoramax.description',
    name: 'Panoramax', // fallback for components that don't support translation keys yet
    description: 'Contribute geolocated photos via mobile app or web',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Panoramax.svg',
    color: 'accent',
    apps: {
      google: 'https://play.google.com/store/apps/details?id=app.panoramax',
      apple: 'https://apps.apple.com/us/app/panoramax-photo/id6677045203',
    },
    order: 1,
    featured: true,
  },
  {
    urls: [
      'https://mapcomplete.org/${mapcomplete_theme}.html?z=${zoom}&lat=${lat}&lon=${lon}&userlayout=${mapcomplete_userlayout}#${osm_feature}/${osm_id_only}',
      'https://mapcomplete.org/${mapcomplete_theme}.html?z=${zoom}&lat=${lat}&lon=${lon}#${osm_feature}/${osm_id_only}',
      'https://mapcomplete.org/${mapcomplete_theme}.html?z=${zoom}&lat=${lat}&lon=${lon}&userlayout=${mapcomplete_userlayout}',
      'https://mapcomplete.org/${mapcomplete_theme}.html?z=${zoom}&lat=${lat}&lon=${lon}',
      'https://mapcomplete.org',
    ],
    nameKey: 'contribute.platforms.mapcomplete.name',
    descriptionKey: 'contribute.platforms.mapcomplete.description',
    name: 'MapComplete',
    description: 'Add images and information directly to this OpenStreetMap location',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/MapComplete.svg',
    color: 'primary',
    apps: {
      google: 'https://play.google.com/store/apps/details?id=org.mapcomplete',
    },
    order: 2,
    featured: true,
  },
  {
    urls: [
      'https://www.wikidata.org/wiki/${qid}',
      'https://commons.wikimedia.org/wiki/Special:UploadWizard',
    ],
    nameKey: 'contribute.platforms.wikimedia_commons.name',
    descriptionKey: 'contribute.platforms.wikimedia_commons.description',
    name: 'Wikimedia Commons',
    description: "Upload free media to the world's largest media library",
    icon: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Commons-logo.svg',
    color: 'secondary',
    order: 3,
  },
  {
    urls: [
      'https://www.openstreetmap.org/${osm_feature}/${osm_id_only}',
      'https://www.openstreetmap.org/#map=${zoom}/${lat}/${lon}',
      'https://www.openstreetmap.org',
    ],
    nameKey: 'contribute.platforms.openstreetmap.name',
    descriptionKey: 'contribute.platforms.openstreetmap.description',
    name: 'OpenStreetMap',
    description: 'The free wiki world map - add and edit geographic data',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Openstreetmap_logo.svg',
    color: 'orange',
    order: 4,
  },
  {
    urls: ['https://www.refuges.info/point/${refuges_id}', 'https://www.refuges.info'],
    nameKey: 'contribute.platforms.refuges.name',
    descriptionKey: 'contribute.platforms.refuges.description',
    name: 'Refuges.info',
    description: 'Outdoor community with hut information, photos, and conditions',
    icon: 'https://www.refuges.info/images/icones/favicon.svg',
    color: 'positive',
    order: 5,
  },
  {
    urls: ['https://www.camptocamp.org/'],
    nameKey: 'contribute.platforms.camptocamp.name',
    descriptionKey: 'contribute.platforms.camptocamp.description',
    name: 'Camptocamp',
    description: 'Outdoor community with hiking and climbing routes',
    icon: 'https://www.camptocamp.org/img/logo.433ae10f.svg',
    color: 'info',
    order: 6,
  },
];

// Compute final links with templates rendered
const contributeLinks = computed<ExternalLink[]>(() => {
  return contributeLinksData
    .map(link => {
      const renderedLink = { ...link };

      // Try each URL template in order, use first one that renders successfully
      for (const urlTemplate of link.urls) {
        const renderedUrl = renderTemplate(urlTemplate, params.value);
        if (renderedUrl !== null) {
          // Successfully rendered - replace urls array with single rendered URL
          renderedLink.urls = [renderedUrl];
          break;
        }
      }

      return renderedLink;
    })
    .sort((a, b) => (a.order || 999) - (b.order || 999));
});

// Separate featured and regular links
const featuredLinks = computed(() => {
  return contributeLinks.value.filter(link => link.featured);
});

const regularLinks = computed(() => {
  return contributeLinks.value.filter(link => !link.featured);
});

function onClose(do_track = false) {
  if (do_track) {
    track('contribute-no-action');
  }

  // Navigation is handled by MainLayout's onDialogHide()
  // which is triggered when v-close-popup closes the dialog
  // No need to call router.back() here
}

function onLinkClick(url: string) {
  track('contribute-external-link', { url });
}

const imgPath = 'https://cdn.pixabay.com/photo/2018/11/09/16/20/photographer-3804979_1280.jpg';

const headerImg = getImageUrl(imgPath, {
  focal: '0.5,0.45',
  size: '800x300',
  quality: 50,
});
</script>

<style lang="scss" scoped>
.card-header {
  filter: blur(15px);
  height: 60px;
}

.card-header__text {
  background: none !important;
  text-shadow: 0px 0px 8px $black;
}

.card--mobile {
  border-radius: unset;
  min-height: 100%;
  height: 100%;
  width: 100%;
  min-width: 100%;
}

.card--desktop {
  min-height: 300px;
  height: 800px;
  max-height: 900px;
  min-width: 300px;
  width: 550px;
  max-width: 600px;
}

.note-banner {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
  border-left: 3px solid var(--q-color-primary);
}

.close-btn-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  padding: 6px;
  border-radius: 8px;
}

.close-btn-overlay :deep(.q-icon) {
  filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.8))
    drop-shadow(0 0 3px rgba(255, 255, 255, 0.5));
}

.no-footer-gap {
  display: flex;
  flex-direction: column;
}

.no-footer-gap > :deep(.q-card-section) {
  flex: 1;
  overflow: hidden;
}

.card-content {
  padding: 0;
  height: calc(100% - 140px);
  /* 140px for header image */
}
</style>

<template>
  <q-card
    :class="{ 'card--desktop': $q.screen.gt.xs, 'card--mobile': $q.screen.xs }"
    class="no-footer-gap"
  >
    <q-btn
      icon="wd-close"
      flat
      dense
      v-close-popup
      @click="onClose(true)"
      class="close-btn-overlay"
      color="white"
    />
    <div>
      <q-img :src="headerImg" style="height: 140px" class="shadow-4">
        <div class="card-header absolute-bottom text-white text-h5"></div>
        <div class="absolute-bottom text-accent-400 text-h4 text-center card-header__text">
          {{ $t('contribute.title') }}
        </div>
      </q-img>
    </div>
    <q-card-section class="card-content">
      <q-scroll-area
        class="fit"
        style="padding: 0 16px 0 16px"
        :thumb-style="{
          width: '6px',
          borderRadius: '8px 0 0 8px',
        }"
      >
        <div class="col no-wrap items-center q-py-md">
          <p class="text-body1 q-pt-md">
            {{ $t('contribute.description') }}
          </p>

          <!-- Global note banner -->
          <div class="note-banner q-mb-md">
            <q-icon name="wd-info-outline" size="sm" class="q-mr-xs" />
            <span class="text-caption text-grey-8">
              {{ $t('contribute.sync_note') }}
            </span>
          </div>

          <!-- Featured Links -->
          <div v-if="featuredLinks.length > 0" class="q-mt-md">
            <div class="row q-col-gutter-md">
              <div v-for="link in featuredLinks" :key="link.name" class="col-12">
                <WdExternalLinkCard :link="link" @click="onLinkClick" />
              </div>
            </div>
          </div>

          <!-- Regular Links -->
          <div v-if="regularLinks.length > 0" class="q-mt-lg">
            <div class="row q-col-gutter-md">
              <div v-for="link in regularLinks" :key="link.name" class="col-12 col-sm-6">
                <WdExternalLinkCard :link="link" @click="onLinkClick" />
              </div>
            </div>
          </div>
        </div>
      </q-scroll-area>
    </q-card-section>
  </q-card>
</template>
