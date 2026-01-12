<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { schemasWodore } from '@clients/index';
import getImageUrl from '@services/imageService';

const $q = useQuasar();
const isMobile = computed(() => $q.screen.xs);

interface Props {
  hut: schemasWodore['HutSearchResultSchema'];
  selected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
});

console.debug(props.hut);
// Emits
const emit = defineEmits<{
  select: [hut: schemasWodore['HutSearchResultSchema'], event: Event];
  preview: [hut: schemasWodore['HutSearchResultSchema']];
}>();

// Get hut type icon URL
const hutTypeIcon = computed<string | undefined>(() => {
  if (!props.hut.place_type || typeof props.hut.place_type !== 'object') {
    return undefined;
  }

  const hutType = props.hut.place_type as Record<string, unknown>;

  // Check for open.symbol (nested structure)
  if (typeof hutType.symbol === 'string') {
    return getImageUrl(hutType.symbol, { fit: true, size: '36x36' });
  }

  return undefined;
});

// Get hut avatar image
// const hutAvatar = computed<string | undefined>(() => {
//   if (!props.hut.avatar) {
//     return undefined;
//   }

//   // If avatar is provided, use it as thumbnail
//   return getImageUrl(props.hut.avatar as string, {
//     fit: true,
//     size: '64x64',
//   });
// });

// Handle click
function onClick(event: Event) {
  emit('select', props.hut, event);
}

// Handle preview click
function onPreviewClick(event: Event) {
  event.stopPropagation();
  emit('preview', props.hut);
}

// Safe access to hut_type.open.name
const hutTypeName = computed<string>(() => {
  if (!props.hut.hut_type || typeof props.hut.hut_type !== 'object') {
    return '';
  }

  const hutType = props.hut.hut_type as Record<string, unknown>;

  if (hutType.open && typeof hutType.open === 'object') {
    const open = hutType.open as Record<string, unknown>;
    if (typeof open.name === 'string') {
      return open.name;
    }
  }

  return '';
});
</script>

<style scoped lang="scss"></style>

<template>
  <q-item clickable v-ripple @click="onClick" :class="{ 'bg-dark-600': selected }" dark dense>
    <q-item-section avatar>
      <img v-if="hutTypeIcon" :src="hutTypeIcon" :alt="hut.name" />
    </q-item-section>
    <q-item-section>
      <q-item-label overline class="text-primary-400" lines="1">{{
        hutTypeName
      }}</q-item-label>
      <q-item-label class="text-primary-100 text-body1" lines="2">{{
        hut.name
      }}</q-item-label>
      <q-item-label caption class="text-primary-300">
        <div v-if="hut.elevation">
          <q-icon size="xs">
            <IconMingcuteMountain2Fill />
          </q-icon>
          <span class="q-pr-xl">{{ hut.elevation }}m</span>
        </div>
        <!-- TODO: add region -->
      </q-item-label>
    </q-item-section>

    <!-- Preview button (desktop only) -->
    <q-item-section v-if="!isMobile" side class="q-pr-md">
      <q-btn flat round dense color="primary-300" @click="onPreviewClick" size="sm">
        <q-icon size="sm">
          <IconEvaEyeOutline />
        </q-icon>
        <q-tooltip :delay="3000">Vorschau auf Karte</q-tooltip>
      </q-btn>
    </q-item-section>
  </q-item>
  <q-separator spaced inset="item" dark />
  <!-- Thumbnail Image (if available)
    <div v-if="hutAvatar" class="hut-thumbnail">
      <img :src="hutAvatar" :alt="hut.name" />
    </div>
--></template>
