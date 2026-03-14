<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { schemasWodore } from '@clients/index';
import getImageUrl from '@services/imageService';

const $q = useQuasar();
const isMobile = computed(() => $q.screen.xs);

interface Props {
  hut: schemasWodore['GeoPlaceSearchSchema'];
  selected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
});

// Emits
const emit = defineEmits<{
  select: [place: schemasWodore['GeoPlaceSearchSchema'], event: Event];
  preview: [place: schemasWodore['GeoPlaceSearchSchema']];
}>();

// Get the first category (as CategoryPlaceTypeSchema or string)
const firstCategory = computed<schemasWodore['CategoryPlaceTypeSchema'] | string | null>(() => {
  if (
    !props.hut.categories ||
    !Array.isArray(props.hut.categories) ||
    props.hut.categories.length === 0
  ) {
    return null;
  }
  return props.hut.categories[0];
});

// Get place type icon URL
const placeTypeIcon = computed<string | undefined>(() => {
  const category = firstCategory.value;
  if (!category || typeof category !== 'object') {
    return undefined;
  }

  const placeType = category as schemasWodore['CategoryPlaceTypeSchema'];

  // Check for symbol.detailed (nested structure for GeoPlaces)
  if (placeType.symbol && typeof placeType.symbol === 'object') {
    const symbol = placeType.symbol as {
      mono?: string;
      detailed?: string;
      simple?: string;
    };
    if (symbol.detailed) {
      return getImageUrl(symbol.detailed, { fit: true, size: '36x36' });
    }
  }

  return undefined;
});

// Get place type name
const placeTypeName = computed<string>(() => {
  const category = firstCategory.value;
  if (!category) {
    return '';
  }

  if (typeof category === 'string') {
    return category;
  }

  if (category.name) {
    return category.name;
  }

  return '';
});

// Handle click
function onClick(event: Event) {
  emit('select', props.hut, event);
}

// Handle preview click
function onPreviewClick(event: Event) {
  event.stopPropagation();
  emit('preview', props.hut);
}
</script>

<style scoped lang="scss"></style>

<template>
  <div>
    <q-item clickable v-ripple @click="onClick" :class="{ 'bg-dark-600': selected }" dark dense>
      <q-item-section avatar>
        <img v-if="placeTypeIcon" :src="placeTypeIcon" :alt="hut.name" />
      </q-item-section>
      <q-item-section>
        <q-item-label overline class="text-primary-400" lines="1">{{ placeTypeName }}</q-item-label>
        <q-item-label class="text-primary-100 text-body1" lines="2">{{ hut.name }}</q-item-label>
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
  </div>
</template>
