<script setup lang="ts">
import { ref, watchEffect } from 'vue';
//import { useRouter, useRoute } from 'vue-router';
import { IntersectionValue } from 'quasar';
import getImageUrl from 'src/services/imageService';
import { clientWodore, schemasWodore } from 'src/clients';

import ToolbarButton from 'components/toolbar/ToolbarButton.vue';

import SourceButtons from './SourceButtons.vue';
import HutType from './HutType.vue';

//const $q = useQuasar();
//const router = useRouter();
//const route = useRoute();

interface Props {
  slug?: string | undefined;
}

const props = defineProps<Props>();

const hut = ref<schemasWodore['HutSchemaDetails'] | null>(null);

//const { data, error } = await
watchEffect(() => {
  if (props.slug) {
    clientWodore
      .GET('/v1/huts/{slug}', {
        params: { path: { slug: props.slug } },
      })
      .then(({ data }) => {
        if (data) {
          hut.value = data;
        }
      });
  }
});

const headerImg = ref('');

const defaultImg =
  'https://cdn.pixabay.com/photo/2020/07/20/21/49/moist-5424448_1280.jpg';
watchEffect(() => {
  if (hut.value?.photos) {
    headerImg.value = getImageUrl(hut.value?.photos, {
      size: '600x400',
      smart: true,
      fit: true,
      //filters: ['grayscale()'],
    });
  } else {
    headerImg.value = getImageUrl(defaultImg, {
      size: '600x400',
      smart: true,
      fit: true,
      filters: ['blur(4)'],
    });
  }
});

//if (!error) {
//} else {
//  console.error(error);
//}
//onBeforeUnmount(() => onClose());

const headerShadow = ref(true);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const addHeaderShadow: IntersectionValue = (entry) => {
  headerShadow.value = !headerShadow.value;
  return true;
};

const watchHut = ref(false);
function toggleHutWatch() {
  watchHut.value = !watchHut.value;
}
const starHut = ref(false);
function toggleHutStar() {
  starHut.value = !starHut.value;
}
</script>

<style lang="scss" scoped>
.no-background {
  background: none !important;
}
.card-header {
  filter: blur(15px);
  height: 60px;
}
.card-header__text {
  background: none !important;
  text-shadow: 0px 0px 8px $black;
}

.card {
  border: 2px solid rgba($black, 0.607);
  border-radius: 0 !important;
}
.hut-image {
  border-radius: 25px !important;
  max-width: 300px;
  min-width: 300px;
}
@media (width <= $breakpoint-xs-max) {
  .hut-image {
    max-width: 300px;
    min-width: 200px;
  }
}
@media (width >= $breakpoint-sm-max) {
  .hut-image {
    max-width: 100%;
  }
}
</style>
<style lang="scss">
.q-layout-container > div > div {
  min-height: 0;
  max-height: 100%;
  height: 100%;
}
.q-layout-container .q-layout {
  min-height: 100%;
  height: 100%;
}
</style>
<style scoped lang="scss">
.attribution {
  font-size: x-small;
  color: rgb(171, 171, 171);
  padding: 6px 20px 6px 10px;
  border-radius: 10px 0 0 0;
}
.img-link :deep(a:active),
.img-link :deep(a:visited),
.img-link :deep(a:hover),
.img-link :deep(a:link),
.img-link :deep(a) {
  color: rgb(171, 171, 171) !important;
  text-decoration: underline dotted;
  text-decoration-color: rgb(132, 132, 132);
}
.img-link :deep(a:hover) {
  color: rgb(242, 242, 242) !important;
}
.img-link {
  color: rgb(171, 171, 171) !important;
}
</style>

<template>
  <q-layout
    v-if="hut"
    view="lhh LpR lff"
    container
    class="no-background fit"
    :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-3'"
    style="height: 100%"
  >
    <q-header
      class="no-background"
      :class="{ 'shadow-2': headerShadow }"
      style="transition: box-shadow 0.2s ease-in-out"
    >
      <q-toolbar class="">
        <q-toolbar-title
          :style="
            ($q.screen.gt.sm ? 'margin-left: 40px' : '') + '; text-wrap: wrap;'
          "
          class="text-primary-900"
        >
          <h1 class="text-h5 q-ma-none q-mt-xs">{{ hut.name }}</h1>
        </q-toolbar-title>
        <ToolbarButton
          size="md"
          :color="starHut ? 'accent' : 'primary-900'"
          :icon="starHut ? 'eva-star' : 'eva-star-outline'"
          @click="toggleHutStar"
        />
        <ToolbarButton
          size="md"
          :color="watchHut ? 'accent' : 'primary-900'"
          :icon="watchHut ? 'eva-eye' : 'eva-eye-outline'"
          @click="toggleHutWatch"
        />
        <ToolbarButton
          size="md"
          class="text-primary-900"
          icon="eva-more-vertical-outline"
        />
      </q-toolbar>
    </q-header>
    <q-page-container class="fit" style="height: 100%">
      <q-scroll-area style="height: 100%" class="fit">
        <q-page style="height: 100%" class="q-px-md fit">
          <!-- used to add shadow to header -->
          <h2
            v-intersection="addHeaderShadow"
            class="text-subtitle1 text-accent-900 q-ma-none q-mb-sm"
          >
            {{ hut.owner?.name }}
          </h2>
          <!-- <q-scroll-area class="fit">
        </q-scroll-area> -->
          <SourceButtons v-if="hut.sources && $q.screen.xs" :hut="hut" />
          <div class="row items-start row q-gutter-sm">
            <div class="col-md-12 col-sm-auto col-auto">
              <div
                :class="{
                  'q-ma-sm': $q.screen.gt.sm,
                  'q-ma-lg': $q.screen.gt.md,
                }"
              >
                <q-img
                  :src="headerImg"
                  class="hut-image"
                  :class="{ 'shadow-8': $q.screen.gt.sm }"
                >
                  <SourceButtons
                    v-if="hut.sources && $q.screen.gt.xs"
                    :hut="hut"
                    style="position: absolute; top: 5px; left: 5px"
                  />
                  <div class="absolute-bottom-right row attribution">
                    <q-icon class="q-mr-sm" name="eva-camera-outline" />
                    <div class="img-link" v-html="hut.photos_attribution" />
                  </div>
                </q-img>
              </div>
            </div>
            <div class="col-md-12 col-sm-4 col-4">
              <div
                class="row items-start justify-start q-gutter-sm"
                :class="{
                  'justify-center': $q.screen.gt.sm,
                  'q-gutter-lg': $q.screen.gt.sm,
                }"
              >
                <HutType
                  class="shadow-0 col-md-6 col-sm-12 col-12"
                  :type="hut.type_open"
                  :capacity="hut.capacity_open"
                  :open="undefined"
                  color="green-3"
                />
                <HutType
                  class="shadow-0 col-md-6 col-sm-12 col-12"
                  :type="hut.type_closed"
                  :capacity="hut.capacity_closed"
                  :open="undefined"
                  color="blue-2"
                />
              </div>
            </div>
          </div>
          <body class="text-body2 q-my-lg">
            {{ hut.description }}
          </body>
        </q-page>
      </q-scroll-area>
    </q-page-container>
  </q-layout>
  <!-- lazy-rules
                :rules="[
                  (val) => (val && val.length > 0) || 'Please type something',
                ]" -->
  <!-- <q-img :src="headerImg">
      <div class="card-header absolute-bottom"></div>
      <div
        class="absolute-bottom text-accent-400 text-center card-header__text"
        :class="{ 'text-h5': isMobile, 'text-h4': !isMobile }"
      >
        {{ hut.name }}
      </div>
    </q-img>
    <div class="col no-wrap items-center">
      <a :href="hut.photos" targe="_blank">original photo</a>
      <pre style="font-size: 8pt">{{ hut }}</pre>
    </div> -->
</template>
