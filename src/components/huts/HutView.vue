<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue';
//import { useRouter, useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import getImageUrl from 'src/services/imageService';
import { clientWodore, schemasWodore } from 'src/clients';

const $q = useQuasar();
//const router = useRouter();
//const route = useRoute();

const isMobile = computed(() => {
  return $q.screen.xs;
});
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

.card {
  border: 2px solid rgba($black, 0.607);
  border-radius: 0 !important;
}
</style>

<template>
  <div v-if="hut">
    <!-- lazy-rules
                :rules="[
                  (val) => (val && val.length > 0) || 'Please type something',
                ]" -->
    <q-img :src="headerImg">
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
    </div>
  </div>
</template>
