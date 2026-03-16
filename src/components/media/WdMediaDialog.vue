<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import WdMediaGallery from './WdMediaGallery.vue';
import type { HutImage } from 'src/composables/useHutImages';

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide } = useDialogPluginComponent();

interface Props {
  images: HutImage[];
  initialSlide?: number;
}

withDefaults(defineProps<Props>(), {
  initialSlide: 0,
});
</script>

<template>
  <q-dialog ref="dialogRef" maximized @hide="onDialogHide">
    <q-card class="bg-black no-border no-box-shadow dialog-card">
      <!-- Media Gallery Component -->
      <WdMediaGallery
        v-if="images.length > 0"
        :images="images"
        :initial-slide="initialSlide"
        @close="onDialogHide"
      />
      <!-- Empty state -->
      <div v-else class="fit flex flex-center text-white">
        <div class="text-center">
          <q-icon name="image_not_supported" size="4rem" />
          <p class="q-mt-md">{{ $t('media.no_images_available') }}</p>
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

:deep(.q-dialog__backdrop) {
  background: rgba(0, 0, 0, 1) !important;
}

:deep(.q-dialog__inner) {
  padding: 0 !important;
}

:deep(.q-card) {
  box-shadow: none;
  border-radius: 0;
}
</style>
