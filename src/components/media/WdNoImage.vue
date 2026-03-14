<script setup lang="ts">
import { computed, type Component } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import IconAddPhoto from '~icons/material-symbols/add-a-photo.svg';

const $q = useQuasar();
const { t } = useI18n();

interface Props {
  message?: string;
  icon?: Component;
  onContribute?: () => void;
  reducedHeight?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  message: 'Add images',
  icon: undefined,
  onContribute: undefined,
  reducedHeight: false,
});

// Computed properties for cleaner template
const isMobile = computed(() => $q.screen.xs);

const iconSize = computed(() => {
  if (props.reducedHeight) {
    return isMobile.value ? '44px' : '52px';
  }
  return isMobile.value ? '76px' : '84px';
});

// Safe handler with null check
const handleClick = () => {
  props.onContribute?.();
};

// Keyboard handler for accessibility
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handleClick();
  }
};
</script>

<template>
  <div class="no-image-container">
    <div class="no-image-wrapper" :class="{ 'reduced-height': reducedHeight }">
      <div class="no-image-content">
        <div
          class="content-wrapper"
          role="button"
          tabindex="0"
          :aria-label="`${message} - Click to add images`"
          @click="handleClick"
          @keydown="handleKeydown"
        >
          <q-iconify
            :is="icon ?? IconAddPhoto"
            :size="iconSize"
            color="grey-5"
            class="contribute-icon"
          />
          <div class="text-section">
            <span class="text-grey-7 status-text" role="status">{{
              t('media.no_photos_yet')
            }}</span>
            <span class="text-grey-6 message-text">{{ message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.no-image-container {
  // Remove max-width to let Quasar grid control width
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

  &.reduced-height {
    padding-top: 33.33%; // 50% of 66.67% = 1:3 aspect ratio (desktop)

    @media (max-width: 599px) {
      padding-top: 50%; // 1:2 aspect ratio (mobile - taller)
    }
  }
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

  .no-image-wrapper.reduced-height & {
    padding: 16px 20px;
  }
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: 8px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;

  // Focus outline for keyboard navigation
  &:focus-visible {
    outline: 2px solid var(--q-primary, #64b5f6);
    outline-offset: 2px;
  }

  &:hover .contribute-icon,
  &:focus-visible .contribute-icon {
    opacity: 1;
    transform: scale(1.08);
    color: #64b5f6;
  }

  &:hover .message-text,
  &:focus-visible .message-text {
    opacity: 1;
    color: #64b5f6;
  }
}

.text-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  line-height: 1.3;
}

.status-text {
  font-size: 1.1rem;
  opacity: 0.7;
  letter-spacing: 0.25px;
  margin: 0;
  padding: 0;
  font-weight: 600;
  line-height: 1.3;

  .no-image-wrapper.reduced-height & {
    font-size: 0.9rem;
  }
}

.contribute-icon {
  opacity: 0.7;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.3));
}

.message-text {
  font-size: 0.85rem;
  opacity: 0.7;
  letter-spacing: 0.25px;
  margin: 0;
  padding: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  line-height: 1.3;

  .no-image-wrapper.reduced-height & {
    font-size: 0.75rem;
  }
}

@media (max-width: 599px) {
  .content-wrapper {
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 12px;
  }

  .text-section {
    align-items: flex-start;
    text-align: left;
    gap: 0;
    line-height: 1.3;
  }

  .status-text {
    font-size: 0.9rem;
    line-height: 1.3;
  }

  .message-text {
    font-size: 0.85rem;
    line-height: 1.3;
  }

  .contribute-icon {
    font-size: 44px !important;
  }
}
</style>
