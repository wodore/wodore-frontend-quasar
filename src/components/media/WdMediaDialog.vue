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
    <q-card class="media-viewer-card no-border no-box-shadow dialog-card">
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
// Fullscreen media viewer surfaces. `bg-black` is NOT pure black here: the
// app redefines Quasar's $black as #1c1c1c (quasar.variables.scss). The theme
// decision lives in ONE place — the --wd-viewer token in app.scss
// (light #1c1c1c charcoal / dark #000 pure black) — applied to every surface
// that fills the viewport behind the photo (card, backdrop, gallery).
.media-viewer-card {
  background: var(--wd-viewer);
}

:deep(.q-dialog__backdrop) {
  background: var(--wd-viewer) !important;
}

:deep(.q-dialog__inner) {
  padding: 0 !important;
}

:deep(.q-card) {
  box-shadow: none;
  border-radius: 0;
}
</style>
