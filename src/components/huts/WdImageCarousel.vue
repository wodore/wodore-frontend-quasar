<script setup lang="ts">
import { ref } from 'vue';
import WdSwiperGallery from './WdSwiperGallery.vue';
import type { HutImage } from 'src/composables/useHutImages';

interface Props {
  images: HutImage[];
  initialSlide?: number;
}

withDefaults(defineProps<Props>(), {
  initialSlide: 0,
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const showDialog = ref(true);

// Close dialog
const closeDialog = () => {
  showDialog.value = false;
  emit('close');
};

// Handle backdrop click - close if clicking outside the gallery
const onBackdropClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  // Close if clicking on the dialog card (backdrop)
  if (target.classList.contains('dialog-card') || target.classList.contains('q-card')) {
    closeDialog();
  }
};
</script>

<template>
  <q-dialog v-model="showDialog" maximized @hide="closeDialog" @keyup.esc="closeDialog">
    <q-card class="bg-black no-border no-box-shadow dialog-card" @click="onBackdropClick">
      <!-- Swiper Gallery Component -->
      <WdSwiperGallery
        v-if="images.length > 0"
        :images="images"
        :initial-slide="initialSlide"
        @close="closeDialog"
        @click.stop
      />
      <!-- Empty state -->
      <div v-else class="fit flex flex-center text-white">
        <div class="text-center">
          <q-icon name="image_not_supported" size="4rem" />
          <p class="q-mt-md">No images available</p>
        </div>
      </div>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
:deep(.q-card) {
  box-shadow: none;
  border-radius: 0;
}
</style>
