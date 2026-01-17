<script setup lang="ts">
import { ref, watchEffect, computed } from 'vue';
//import { useRouter, useRoute } from 'vue-router';
import { copyToClipboard } from 'quasar';
import { IntersectionValue, useQuasar } from 'quasar';
import getImageUrl from '@services/imageService';
import { clientWodore, schemasWodore } from '@clients/index';
import { useHutsStore } from '@stores/huts-store';
import { storeToRefs } from 'pinia';
import { useMeta } from 'quasar';
const { selectedMonth } = storeToRefs(useHutsStore());

const $q = useQuasar();
//const router = useRouter();
//const route = useRoute();

interface Props {
  slug?: string | undefined;
}

const props = defineProps<Props>();

const hut = ref<schemasWodore['HutSchemaDetails'] | undefined>(undefined);

const isHutOpen = computed<schemasWodore['AnswerEnum']>(() => {
  const currentMonth = selectedMonth.value; //(new Date().getMonth() + 1).toString().padStart(2, '0');
  if (
    hut.value?.open_monthly === undefined ||
    hut.value?.open_monthly == null
  ) {
    return 'unknown';
  }
  const o = hut.value?.open_monthly[`month_${currentMonth}`];
  if (o === undefined) {
    return 'unknown';
  }
  return o as schemasWodore['AnswerEnum'];
});

const isHutClosed = computed<
  'yes' | 'yesish' | 'no' | 'noish' | 'maybe' | 'unknown'
>(() => {
  switch (isHutOpen.value) {
    case 'yes':
      return 'no';
    case 'yesish':
      return 'noish';
    case 'no':
      return 'yes';
    case 'noish':
      return 'yesish';
  }
  return isHutOpen.value;
});
const headerShadow = ref(false);
//const { data, error } = await
watchEffect(() => {
  // Don't reset hut.value to undefined - keep showing previous hut until new data loads
  headerShadow.value = false;
  if (props.slug) {
    clientWodore
      .GET('/v1/huts/{slug}', {
        params: { path: { slug: props.slug } },
      })
      .then(({ data }) => {
        if (data) {
          hut.value = data;
          let desc = hut.value.name + ' - ';
          let cap = '';
          if (
            hut.value.type_open?.name &&
            hut.value.type_open.slug != 'unknown'
          ) {
            desc +=
              hut.value.type_open.name?.charAt(0).toUpperCase() +
              hut.value.type_open.name?.slice(1);
            if (hut.value.capacity_open && hut.value.capacity_open > 0) {
              cap = ` mit ${hut.value.capacity_open}`;
            }
          }
          if (
            hut.value.type_closed &&
            hut.value.type_closed.slug != 'unknown'
          ) {
            desc += '/' + hut.value.type_closed.name;
            if (
              hut.value.capacity_closed &&
              hut.value.capacity_closed > 0 &&
              hut.value.capacity_closed != hut.value.capacity_open
            ) {
              cap += `, resp. ${hut.value.capacity_closed},`;
            }
          }
          if (hut.value.elevation) {
            desc += ` auf ${hut.value.elevation}m`;
          }
          if (cap) {
            cap += ' Plätzen.';
          }
          const appTitle = process.env.WODORE_APP_NAME || 'Wodore';
          const metaData = {
            title: hut.value.name ? hut.value.name : appTitle,
            meta: {
              description: {
                name: 'description',
                content: desc + cap,
              },
            },
          };
          useMeta(metaData);
        }
      });
  }
});

const headerImg = ref<string | undefined>(undefined);

const hutToolbarTop = computed(() => $q.screen.gt.sm);
//const defaultImg =
//  'https://cdn.pixabay.com/photo/2020/07/20/21/49/moist-5424448_1280.jpg';

watchEffect(() => {
  if (hut.value?.photos) {
    headerImg.value = getImageUrl(hut.value?.photos, {
      size: '600x400',
      smart: true,
      fit: true,
      //filters: ['grayscale()'],
    });
  } else {
    headerImg.value = undefined;
    //getImageUrl(defaultImg, {
    //  size: '600x400',
    //  smart: true,
    //  fit: true,
    //  filters: ['blur(4)'],
    //});
  }
});

//if (!error) {
//} else {
//  console.error(error);
//}
//onBeforeUnmount(() => onClose());

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const addHeaderShadow: IntersectionValue = (entry) => {
  headerShadow.value = !entry.isIntersecting;
  return true;
};
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
  min-width: 200px;
}

@media (width <=$breakpoint-xs-max) {
  .hut-image {
    max-width: 300px;
    min-width: 100px;
  }
}

@media (width >=$breakpoint-sm-max) {
  .hut-image {
    max-width: 100%;
  }
}
</style>
<style lang="scss">
.q-layout-container>div>div {
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
.footer-toolbar {
  border-top: 1px solid black;
}

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

.attr_link :deep(a:active),
.attr_link :deep(a:visited),
.attr_link :deep(a:hover),
.attr_link :deep(a:link),
.attr_link :deep(a) {
  color: rgb(171, 171, 171);
  text-decoration: underline dotted;
  text-decoration-color: rgb(132, 132, 132);
}

.attr_link :deep(a:hover) {
  color: rgb(81, 81, 81);
}

.attr_link {
  color: rgb(171, 171, 171);
  // position: relative;
  // top: -40px;
  // right: 25px;
}
</style>

<template>
  <q-layout view="lhh LpR lff" container class="no-background fit" :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-3'"
    style="height: 100%">
    <WdHutHeader :hut="hut" :ontop="headerShadow">
      <WdHutToolbar :hut="hut" v-if="hutToolbarTop">
        <WdSourceButtons :hut="hut" class="q-ml-xl" />
      </WdHutToolbar>
    </WdHutHeader>
    <q-page-container class="fit" style="height: 100%">
      <q-scroll-area visible :thumb-style="{
        width: '6px',
        backgroundColor: '#998019',
        opacity: '0.5',
        borderRadius: '8px 0 0 8px',
      }" style="height: 100%" class="fit">
        <q-page style="height: 100%" class="q-px-md fit" v-if="hut">
          <!-- used to add shadow to header -->
          <h2 :style="($q.screen.gt.sm ? 'margin-top: -3px; ' : '') + 'text-wrap: wrap;'
            " class="text-subtitle1 text-accent-900 q-ma-none q-mb-sm">
            <span v-intersection="addHeaderShadow" />
            {{ hut.owner?.name }}
          </h2>

          <div class="row items-start q-gutter-sm">
            <div v-if="hut.images && hut.images[0] && 'urls' in hut.images[0]" class="col-md-12 col-sm-7 col-7">
              <div :class="{
                'q-ma-sm': $q.screen.gt.sm,
                'q-ma-lg': $q.screen.gt.md,
              }">
                <a :href="(hut.images[0] as any).urls['medium']" target="_blank">
                  <q-img :src="(hut.images[0] as any).urls['preview']" :placeholder-src="(hut.images[0] as any).urls['preview-placeholder']
                    " class="hut-image" :class="{ 'shadow-8': $q.screen.gt.sm }">
                    <div class="absolute-bottom-right row attribution">
                      <q-icon class="q-mr-sm" name="eva-camera-outline" />
                      <div class="img-link" v-html="hut.photos_attribution" />
                    </div>
                  </q-img>
                </a>
                <!-- <a :href="(hut.images[0] as any).urls['600x400']">open</a> -->
              </div>
            </div>
            <div class="col-md-12" :class="{
              'col-sm-4': headerImg,
              'col-4': headerImg,
              'col-12': !headerImg,
            }">
              <div class="row items-start justify-start q-gutter-sm" :class="{
                'justify-center': $q.screen.gt.sm && headerImg,
                'q-gutter-lg': $q.screen.gt.sm,
              }">
                <WdHutTypeChip class="shadow-0 col-md-6 col-sm-12 col-12" :type="hut.type_open"
                  :capacity="hut.capacity_open" :open="isHutOpen" />
                <WdHutTypeChip class="shadow-0 col-md-6 col-sm-12 col-12" :type="hut.type_closed"
                  :capacity="hut.capacity_closed" :open="isHutClosed" />
                <!-- Location Chip -->
                <q-chip size="md" class="bg-grey-4 q-mr-none shadow-0 col-md-6 col-sm-12 col-12"
                  style="min-width: 90px; max-width: 90px; max-height: 30px" v-if="hut.elevation">
                  <q-avatar class="bg-grey-5" text-color="primary-500">
                    <q-icon size="20px">
                      <IconMingcuteMountain2Fill />
                    </q-icon>
                  </q-avatar>
                  <span class="text-primary-500" style="font-weight: 500; width: 28px">{{ hut.elevation }} m</span>
                </q-chip>
              </div>
            </div>
          </div>

          <body class="text-body2 q-my-sm">
            <!-- {{ hut.description }} -->
            <div class="attribution attr_link text-right" style="padding: 0" v-html="hut.description_attribution"></div>
            <WdTextClamp :max-lines="5" :text="hut.description" style="padding-bottom: 0" />
          </body>

          <WdHutAvailabilities v-if="slug" :slug="slug" :has-availability="hut.has_availability ?? undefined"
            :symbol-map="{
              ...(hut.type_open?.slug
                ? {
                  [hut.type_open.slug]: {
                    detailed: `https://hub.wodore.com/media/huts/types/symbols/detailed/${hut.type_open.slug}.png`,
                    simple: `https://hub.wodore.com/media/huts/types/symbols/simple/${hut.type_open.slug}.png`,
                  },
                }
                : {}),
              ...(hut.type_closed?.slug
                ? {
                  [hut.type_closed.slug]: {
                    detailed: `https://hub.wodore.com/media/huts/types/symbols/detailed/${hut.type_closed.slug}.png`,
                    simple: `https://hub.wodore.com/media/huts/types/symbols/simple/${hut.type_closed.slug}.png`,
                  },
                }
                : {}),
              unknown: {
                detailed: 'https://hub.wodore.com/media/huts/types/symbols/detailed/unknown.png',
                simple: 'https://hub.wodore.com/media/huts/types/symbols/simple/unknown.png',
              },
            }" />

          <WdHutOpenMonthly :open_monthly="hut.open_monthly" :type_open="hut.type_open"
            :type_closed="hut.type_closed" />
          <!--LOCATION-->
          <div class="text-subtitle1 text-accent">{{ $t('location') }}</div>
          <q-list dense>
            <q-item v-if="hut.location">
              <q-item-section side>
                <q-icon size="xs">
                  <IconFa6SolidLocationCrosshairs />
                </q-icon>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ hut.location.lat.toPrecision(7) }},
                  {{ hut.location.lon.toPrecision(6) }}</q-item-label>
              </q-item-section>
              <q-item-section side @click="
                copyToClipboard(
                  hut.location.lat.toPrecision(7).toString() +
                  ', ' +
                  hut.location.lon.toPrecision(6).toString(),
                )
                ">
                <q-btn flat dense round size="10pt">
                  <q-icon size="10pt">
                    <IconFa6SolidCopy />
                  </q-icon>
                </q-btn>
              </q-item-section>
            </q-item>
            <q-item v-if="hut.elevation">
              <q-item-section side>
                <q-icon size="xs">
                  <IconMingcuteMountain2Fill />
                </q-icon>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ hut.elevation }} m</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-page>
      </q-scroll-area>
    </q-page-container>
    <q-footer class="footer-toolbar">
      <WdHutToolbar :hut="hut" v-if="!hutToolbarTop">
        <WdSourceButtons :hut="hut" />
      </WdHutToolbar>
    </q-footer>
  </q-layout>
</template>
