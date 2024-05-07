<script setup lang="ts">
import { StyleSwitchItem } from './styles';

//import { Lang } from 'src/i18n';

interface Props {
  item: StyleSwitchItem;
}
defineProps<Props>();

//import { StyleSwitchItem } from 'stores/map/map-style-store';
//import { useMapStyleStore } from 'stores/map/map-style-store';
////import { computed, ref, WritableComputedRef } from 'vue';
//import { useRouter, useRoute } from 'vue-router';
////import { ref } from 'vue';
//
//const $router = useRouter();
//const $route = useRoute();
//const { setActiveStyle } = useMapStyleStore();
////const lastMapStyle = useStorage('myMapStyle', undefined);
//const props = defineProps<{
//  modelValue: StyleSwitchItem;
//}>();
//
//function setActive() {
//  setActiveStyle({ name: props.modelValue.name });
//  //lastMapStyle.value = props.modelValue.name;
//  //let query = { ...$route.query };
//  //query.map = props.modelValue.name;
//  //$router.replace({ query: query });
//}
//const emit = defineEmits<{
//  (event: 'update:modelValue', payload: StyleSwitchItemWithStyleSpec): void;
//}>();
//console.log('Style v-model: ', props.modelValue);
</script>

<template>
  <!-- <q-fab-action>
    <template #icon>
      <q-avatar round size="55px">
        <img style="padding: 3px" :src="item.img" />
      </q-avatar>
    </template>
  </q-fab-action> -->
  <!-- @click="setActive()" -->
  <q-btn
    style="padding: 0"
    :ripple="false"
    :color="item.active ? 'accent-500' : 'primary-400'"
  >
    <q-avatar size="55px" square>
      <img style="padding: 3px" :src="item.img" />
    </q-avatar>
  </q-btn>
  <!-- <q-btn square avatar @click="setActiveStyle({ name: modelValue.name })">
    <template v-slot:icon>
      <q-avatar rounded>
        <img style="border: 2px solid" :src="`/maps/${modelValue.name}.png`" />
      </q-avatar>
    </template>
  </q-btn> -->

  <!-- </q-fab-action> -->

  <!-- <q-item
    clickable
    @click="setActiveStyle({ name: modelValue.name })"
    :active="modelValue.active"
    active-class="bg-orange-2 text-orange">
    <q-item-section side avatar>
      <q-avatar rounded>
        <img style="border: 2px solid" :src="`/maps/${modelValue.name}.png`" />
      </q-avatar>
    </q-item-section>
    <q-item-section>
      <q-item-label>{{ modelValue.label }}</q-item-label>
      <q-item-label caption>{{ modelValue.source }}</q-item-label>
    </q-item-section>
  </q-item> -->
</template>
