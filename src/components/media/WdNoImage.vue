<script setup lang="ts">
import { type Component } from 'vue';
import { useQuasar } from 'quasar';
import IconAddPhoto from '~icons/material-symbols/add-a-photo.svg';

const $q = useQuasar();

interface Props {
  message?: string;
  icon?: string | Component | Record<string, unknown> | undefined;
  onContribute?: () => void;
}

withDefaults(defineProps<Props>(), {
  message: 'No images',
  icon: undefined,
  onContribute: undefined,
});
</script>

<template>
  <div class="no-image-container">
    <div class="no-image-wrapper">
      <div class="no-image-content">
        <q-iconify
          :is="(icon || IconAddPhoto) as Component"
          :size="$q.screen.xs ? '72px' : '80px'"
          color="grey-5"
          class="contribute-icon"
          @click="onContribute"
        />
        <p class="text-grey-7 message-text">{{ message }}</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.no-image-container {
  max-width: 400px;
  margin: 0 auto;
  width: 100%;
  // Ensure border-box for consistent sizing across components
  box-sizing: border-box;
}

.no-image-wrapper {
  position: relative;
  width: 100%;
  padding-top: 66.67%; // 3:2 aspect ratio (landscape)
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
  // Ensure border-box for consistent sizing
  box-sizing: border-box;
}

.no-image-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 40px;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  // Ensure border-box for consistent sizing
  box-sizing: border-box;
}

.contribute-icon {
  opacity: 0.7;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.3));

  &:hover {
    opacity: 1;
    transform: scale(1.08);
    color: #64b5f6;
    filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.3));
  }
}

.message-text {
  font-size: 0.95rem;
  opacity: 0.85;
  letter-spacing: 0.25px;
  margin-top: 12px;
}

@media (max-width: 599px) {
  .message-text {
    font-size: 0.85rem;
    margin-top: 8px;
  }
}
</style>
