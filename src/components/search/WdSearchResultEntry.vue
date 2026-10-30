<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { schemasWodore } from '@clients/index';
import WdCategoryIcon from '@components/categories/WdCategoryIcon.vue';

const $q = useQuasar();
const isMobile = computed(() => $q.screen.xs);

interface Props {
  place: schemasWodore['GeoPlaceSearchSchema'];
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

// Anchoring kind category (backend PR #456): {identifier, slug, color} —
// present only for places with an anchor category and only when `kind` is
// in the sparse-fieldset selection. Keys the avatar icon without loading
// the categories member; `domain` (always present, plain values:
// amenity | admin | natural | none) is the tier fallback.
const kindIdentifier = computed(() => (props.place.kind ? props.place.kind.identifier : ''));
const tier = computed(() => props.place.domain || 'none');

// Handle click
function onClick(event: Event) {
  emit('select', props.place, event);
}

// Handle preview click
function onPreviewClick(event: Event) {
  event.stopPropagation();
  emit('preview', props.place);
}
</script>

<style scoped lang="scss">
.wd-selected {
  background: var(--wd-wash) !important;
}
.wd-ink-text {
  color: var(--wd-ink) !important;
}
.wd-ink-soft-text {
  color: var(--wd-ink-soft) !important;
}
.wd-info-text {
  color: var(--wd-info) !important;
}
</style>

<template>
  <div>
    <q-item clickable v-ripple @click="onClick" :class="{ 'wd-selected': selected }" dense>
      <q-item-section avatar>
        <WdCategoryIcon
          v-if="kindIdentifier"
          :identifier="kindIdentifier"
          variant="color"
          :size="36"
        />
        <!-- Tier fallback (no anchor kind on this place): domain maps to
             the super-root tier icon -->
        <q-icon v-else-if="tier === 'admin'" size="28px" class="wd-info-text">
          <IconMingcuteBuilding2Line />
        </q-icon>
        <q-icon v-else-if="tier === 'natural'" size="28px" class="wd-info-text">
          <IconMingcuteMountainLine />
        </q-icon>
        <q-icon v-else size="28px" class="wd-info-text">
          <IconMingcuteMapPinLine />
        </q-icon>
      </q-item-section>
      <q-item-section>
        <q-item-label overline class="wd-info-text" lines="1">{{
          place.country_code
        }}</q-item-label>
        <q-item-label class="wd-ink-text text-body1" lines="2">{{ place.name }}</q-item-label>
        <q-item-label caption class="wd-ink-soft-text">
          <div v-if="place.elevation">
            <q-icon size="xs">
              <IconMingcuteMountain2Fill />
            </q-icon>
            <span class="q-pr-xl">{{ place.elevation }}m</span>
          </div>
          <!-- TODO: add region -->
        </q-item-label>
      </q-item-section>

      <!-- Preview button (desktop only) -->
      <q-item-section v-if="!isMobile" side class="q-pr-md">
        <q-btn flat round dense class="wd-info-text" @click="onPreviewClick" size="sm">
          <q-icon size="sm">
            <IconEvaEyeOutline />
          </q-icon>
          <q-tooltip :delay="3000">{{ $t('search_ui.preview_on_map') }}</q-tooltip>
        </q-btn>
      </q-item-section>
    </q-item>
    <q-separator spaced inset="item" />
  </div>
</template>
