<script setup lang="ts">
import { type Component } from 'vue';
import IconAddPhoto from '~icons/material-symbols/add-a-photo.svg';

interface Props {
  message?: string;
  icon?: string | Component | Record<string, unknown> | undefined;
  onContribute?: () => void;
}

withDefaults(defineProps<Props>(), {
  message: 'No images available',
  icon: undefined,
  onContribute: undefined,
});
</script>

<template>
  <div class="no-image-container">
    <div class="no-image-wrapper">
      <div class="flex flex-center column no-image-content">
        <q-iconify
          :is="(icon || IconAddPhoto) as Component"
          size="72px"
          color="grey-5"
          class="contribute-icon"
          @click="onContribute"
        />
        <p class="q-mt-md text-grey-7 message-text">{{ message }}</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.no-image-container {
  max-width: 400px;
  margin: 0 auto;
  width: 100%;
}

.no-image-wrapper {
  position: relative;
  width: 100%;
  padding-top: 66.67%; // 3:2 aspect ratio (landscape)
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
}

.no-image-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 40px;
}

.contribute-icon {
  opacity: 0.5;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;

  &:hover {
    opacity: 1;
    transform: scale(1.08);
    color: #64b5f6;
  }
}

.message-text {
  font-size: 1rem;
  opacity: 0.85;
  letter-spacing: 0.25px;
}
</style>
