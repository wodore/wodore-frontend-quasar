<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import getImageUrl from '@services/imageService';
import WdExternalLinkCard from './WdExternalLinkCard.vue';
import track from '@services/analytics';
import type { ExternalLink } from '../../../types/contribute';

const $q = useQuasar();
const router = useRouter();
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

  // Parse lat/lon from query string (overrides hash if provided)
  if (route.query.lat) {
    result.lat = String(route.query.lat);
  }
  if (route.query.lon) {
    result.lon = String(route.query.lon);
  }
  if (route.query.zoom) {
    result.zoom = String(route.query.zoom);
  }

  // Parse osm_id and extract feature type and ID
  if (route.query.osm_id) {
    const osmId = String(route.query.osm_id);
    result.osm_id = osmId;

    // Extract feature type and ID (e.g., "node/123" -> feature: "node", id: "123")
    if (osmId.includes('/')) {
      const [feature, id] = osmId.split('/');
      result.osm_feature = feature;
      result.osm_feature_short = feature.charAt(0).toLowerCase();
      result.osm_id_only = id;
    }
  }

  // Parse osm_feature and osm_id_only directly if provided
  if (route.query.osm_feature) {
    result.osm_feature = String(route.query.osm_feature);
  }
  if (route.query.osm_id_only) {
    result.osm_id_only = String(route.query.osm_id_only);
    // Build full osm_id if we have both feature and id
    if (result.osm_feature) {
      result.osm_id = `${result.osm_feature}/${result.osm_id_only}`;
    }
  }

  // Parse mapcomplete theme
  if (route.query.mapcomplete_theme) {
    result.mapcomplete_theme = String(route.query.mapcomplete_theme);
  }

  // Parse mapcomplete userlayout
  if (route.query.mapcomplete_userlayout) {
    result.mapcomplete_userlayout = String(route.query.mapcomplete_userlayout);
  }

  // Parse refuges ID
  if (route.query.refuges_id) {
    result.refuges_id = String(route.query.refuges_id);
  }

  // Parse Wikidata ID
  if (route.query.qid) {
    result.qid = String(route.query.qid);
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

// Define contribution links
// Logic and information separated - could be moved to backend later
const contributeLinksData: ExternalLink[] = [
  {
    urls: [
      'https://panoramax.openstreetmap.fr/#map=${zoom}/${lat}/${lon}',
      'https://panoramax.openstreetmap.fr/',
    ],
    name: 'Panoramax',
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
    name: 'OpenStreetMap',
    description: 'The free wiki world map - add and edit geographic data',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Openstreetmap_logo.svg',
    color: 'orange',
    order: 4,
  },
  {
    urls: ['https://www.refuges.info/point/${refuges_id}', 'https://www.refuges.info'],
    name: 'Refuges.info',
    description: 'Outdoor community with hut information, photos, and conditions',
    icon: 'https://www.refuges.info/images/icones/favicon.svg',
    color: 'positive',
    order: 5,
  },
  {
    urls: ['https://www.camptocamp.org/'],
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
  router.go(-1);
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
</style>

<template>
  <q-card :class="{ 'card--desktop': $q.screen.gt.xs, 'card--mobile': $q.screen.xs }">
    <div>
      <q-img :src="headerImg" style="height: 140px" class="shadow-4">
        <div class="card-header absolute-bottom text-white text-h5"></div>
        <div class="absolute-bottom text-accent-400 text-h4 text-center card-header__text">
          Contribute
        </div>
      </q-img>
    </div>
    <q-card-section style="padding: 0; height: calc(100% - 196px)">
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
            Help improve Wodore and the outdoor community! Add photos and information through these
            platforms. Your contributions to OpenStreetMap and uploaded images sync back to this
            page.
          </p>

          <!-- Global note banner -->
          <div class="note-banner q-mb-md">
            <q-icon name="wd-info-outline" size="sm" class="q-mr-xs" />
            <span class="text-caption text-grey-8">
              Images and information are synced periodically (typically every 14 days)
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
    <q-separator />
    <q-card-actions>
      <q-space />
      <q-btn label="Close" color="secondary-700" flat @click="onClose(true)" class="q-ml-sm" />
    </q-card-actions>
  </q-card>
</template>
