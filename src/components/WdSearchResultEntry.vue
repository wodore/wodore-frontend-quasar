<script setup lang="ts">
import { computed } from 'vue';
import { schemasWodore } from '@clients/index';
import getImageUrl from '@services/imageService';

interface Props {
  hut: schemasWodore['HutSearchResultSchema'];
  selected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
});

console.debug(props.hut)
// Emits
const emit = defineEmits<{
  select: [hut: schemasWodore['HutSearchResultSchema']];
}>();

// Get hut type icon URL
const hutTypeIcon = computed<string | undefined>(() => {
  if (!props.hut.hut_type || typeof props.hut.hut_type !== 'object') {
    return undefined;
  }

  const hutType = props.hut.hut_type as Record<string, unknown>;

  // Check for open.symbol (nested structure)
  if (hutType.open && typeof hutType.open === 'object') {
    const open = hutType.open as Record<string, unknown>;
    if (typeof open.symbol === 'string') {
      return getImageUrl(open.symbol, { fit: true, size: '36x36' });
    }
  }

  // Fallback to direct symbol field
  if (typeof hutType.symbol === 'string') {
    return getImageUrl(hutType.symbol, { fit: true, size: '36x36' });
  }

  return undefined;
});

// Get hut avatar image
const hutAvatar = computed<string | undefined>(() => {
  if (!props.hut.avatar) {
    return undefined;
  }

  // If avatar is provided, use it as thumbnail
  return getImageUrl(props.hut.avatar as string, {
    fit: true,
    size: '64x64',
  });
});

// Handle click
function onClick() {
  emit('select', props.hut);
}
</script>

<style scoped lang="scss"></style>

<template>
  <q-item clickable v-ripple @click="onClick">
    <q-item-section avatar>
      <img v-if="hutTypeIcon" :src="hutTypeIcon" :alt="hut.name" />
    </q-item-section>
    <q-item-section>
      <q-item-label overline class="text-secondary-700" lines="1">{{ hut.hut_type.open.name }}</q-item-label>
      <q-item-label class="text-primary-700 text-body1" lines="2">{{ hut.name }}</q-item-label>
      <q-item-label caption>

        <div v-if="hut.elevation">
          <q-icon size="xs">
            <IconMingcuteMountain2Fill />
          </q-icon>
          <span class="q-pr-xl">{{ hut.elevation }}m</span>
        </div>
        <!-- TODO: add region -->
      </q-item-label>

    </q-item-section>
  </q-item><q-separator spaced inset="item" />
  <!-- Thumbnail Image (if available)
    <div v-if="hutAvatar" class="hut-thumbnail">
      <img :src="hutAvatar" :alt="hut.name" />
    </div>
-->
</template>
