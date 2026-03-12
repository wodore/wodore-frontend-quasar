<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import IconAndroid from '~icons/material-symbols/android.svg';
import IconApple from '~icons/bxl/apple';
import IconStar from '~icons/material-symbols/star.svg';
import type { ExternalLink } from '../../types/contribute';

const { t } = useI18n();

interface Props {
  link: ExternalLink;
  color?: string;
}

const props = withDefaults(defineProps<Props>(), {
  color: 'primary',
});

const emit = defineEmits<{
  (e: 'click', url: string): void;
}>();

// Get translated name and description
const displayName = computed(() => {
  return props.link.nameKey ? t(props.link.nameKey) : props.link.name;
});

const displayDescription = computed(() => {
  return props.link.descriptionKey ? t(props.link.descriptionKey) : props.link.description;
});

// Get the final URL (already rendered by parent component)
const finalUrl = computed(() => {
  return props.link.urls?.[0] || '';
});

// Check if has app links
const hasAppLinks = computed(() => {
  return props.link.apps && (props.link.apps.google || props.link.apps.apple);
});

// Open the main URL
const openLink = () => {
  emit('click', finalUrl.value);
  window.open(finalUrl.value, '_blank');
};

// Open app store link
const openAppStore = (event: Event, store: 'google' | 'apple') => {
  event.stopPropagation(); // Prevent card click
  const url = props.link.apps?.[store];
  if (url) {
    emit('click', url);
    window.open(url, '_blank');
  }
};
</script>

<template>
  <q-card
    flat
    bordered
    class="external-link-card"
    :class="[`border-${color}`, { 'featured-card': link.featured }]"
    clickable
    @click="openLink"
  >
    <!-- Featured card layout -->
    <template v-if="link.featured">
      <q-card-section class="q-pa-md">
        <div class="row items-start no-wrap">
          <div v-if="link.icon" class="platform-icon-container featured-icon">
            <q-img :src="link.icon" class="platform-icon" fit="contain" no-spinner />
          </div>
          <div class="col q-pl-md">
            <div class="row items-center justify-between q-mb-xs">
              <div class="text-title text-h5">
                {{ displayName }}
                <q-iconify :is="IconStar" color="yellow-9" size="sm" class="star-icon q-ml-sm" />
              </div>
              <div v-if="hasAppLinks" class="app-store-badges">
                <q-btn
                  v-if="link.apps?.google"
                  flat
                  dense
                  size="sm"
                  @click="openAppStore($event, 'google')"
                  class="store-badge android"
                >
                  <q-iconify :is="IconAndroid" size="14px" class="q-mr-xs" />
                  <span>Android</span>
                </q-btn>
                <q-btn
                  v-if="link.apps?.apple"
                  flat
                  dense
                  size="sm"
                  @click="openAppStore($event, 'apple')"
                  class="store-badge ios q-ml-xs"
                >
                  <q-iconify :is="IconApple" size="14px" class="q-mr-xs" />
                  <span>iOS</span>
                </q-btn>
              </div>
            </div>
            <div class="text-caption text-grey-7">
              {{ displayDescription }}
            </div>
          </div>
        </div>
      </q-card-section>
    </template>

    <!-- Regular card layout (compact) -->
    <template v-if="!link.featured">
      <q-card-section class="q-pa-sm">
        <!-- Icon + Name row -->
        <div class="row items-center no-wrap q-mb-xs">
          <div v-if="link.icon" class="platform-icon-container regular-icon">
            <q-img :src="link.icon" class="platform-icon" fit="contain" no-spinner />
          </div>
          <div class="col q-pl-sm">
            <div class="row items-center justify-between">
              <div class="text-body2 text-weight-medium">
                {{ displayName }}
              </div>
              <div v-if="hasAppLinks" class="app-store-badges">
                <q-btn
                  v-if="link.apps?.google"
                  flat
                  dense
                  size="sm"
                  @click="openAppStore($event, 'google')"
                  class="store-badge android"
                >
                  <q-iconify :is="IconAndroid" size="12px" class="q-mr-xs" />
                  <span>Android</span>
                </q-btn>
                <q-btn
                  v-if="link.apps?.apple"
                  flat
                  dense
                  size="sm"
                  @click="openAppStore($event, 'apple')"
                  class="store-badge ios q-ml-xs"
                >
                  <q-iconify :is="IconApple" size="12px" class="q-mr-xs" />
                  <span>iOS</span>
                </q-btn>
              </div>
            </div>
          </div>
        </div>
        <!-- Description on new line, full width -->
        <div class="text-caption text-grey-7">
          {{ displayDescription }}
        </div>
      </q-card-section>
    </template>
  </q-card>
</template>

<style lang="scss" scoped>
.external-link-card {
  border-radius: 12px;
  transition: all 0.2s ease;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #ffffff;
  height: 100%;
  position: relative;
  overflow: hidden;
  cursor: pointer;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: var(--q-color-accent);

    .platform-icon-container {
      background-color: rgba(0, 0, 0, 0.05);
    }
  }

  // Featured cards - larger, fancier design
  &.featured-card {
    border-left-width: 5px;
    background: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.02) 0%,
      rgba(0, 0, 0, 0.01) 50%,
      transparent 100%
    );
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

    &:hover {
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
      transform: translateY(-2px);
    }

    .platform-icon-container {
      width: 64px;
      height: 64px;
      min-width: 64px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }

  // Color variants
  &.border-primary {
    border-left-color: #346751;

    &:hover {
      border-left-color: var(--q-color-accent);
    }

    .platform-icon-container {
      background: linear-gradient(135deg, rgba(52, 103, 81, 0.15), rgba(52, 103, 81, 0.08));
    }
  }

  &.border-accent {
    border-left-color: #ff6b35;

    &:hover {
      border-left-color: var(--q-color-accent);
    }

    .platform-icon-container {
      background: linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(255, 107, 53, 0.08));
    }
  }

  &.border-secondary {
    border-left-color: #333333;

    &:hover {
      border-left-color: var(--q-color-accent);
    }

    .platform-icon-container {
      background: linear-gradient(135deg, rgba(51, 51, 51, 0.15), rgba(51, 51, 51, 0.08));
    }
  }

  &.border-positive {
    border-left-color: #7cb342;

    &:hover {
      border-left-color: var(--q-color-accent);
    }

    .platform-icon-container {
      background: linear-gradient(135deg, rgba(124, 179, 66, 0.15), rgba(124, 179, 66, 0.08));
    }
  }

  &.border-info {
    border-left-color: #26a69a;

    &:hover {
      border-left-color: var(--q-color-accent);
    }

    .platform-icon-container {
      background: linear-gradient(135deg, rgba(38, 166, 154, 0.15), rgba(38, 166, 154, 0.08));
    }
  }

  &.border-orange {
    border-left-color: #ff9800;

    &:hover {
      border-left-color: var(--q-color-accent);
    }

    .platform-icon-container {
      background: linear-gradient(135deg, rgba(255, 152, 0, 0.15), rgba(255, 152, 0, 0.08));
    }
  }
}

.platform-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  flex-shrink: 0;
  transition: all 0.2s ease;
  padding: 6px;

  // Featured icons (larger)
  &.featured-icon {
    width: 64px;
    height: 64px;
    min-width: 64px;
  }

  // Regular icons (smaller)
  &.regular-icon {
    width: 32px;
    height: 32px;
    min-width: 32px;
    padding: 4px;
  }
}

.platform-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.star-icon {
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

.app-store-badges {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.store-badge {
  border: 1px solid currentColor;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.2s ease;
  min-height: 24px;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  &.android {
    color: #000000;

    &:hover {
      background: rgba(0, 0, 0, 0.05);
    }
  }

  &.ios {
    color: #000000;

    &:hover {
      background: rgba(0, 0, 0, 0.05);
    }
  }
}
</style>
