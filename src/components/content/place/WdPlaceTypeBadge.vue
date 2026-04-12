<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  color?: string;
  bgColor?: string;
  icon?: string;
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  color: '#346751',
  bgColor: undefined,
});

const bgStyle = computed(() => {
  const hex = props.color;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    borderLeftColor: hex,
    backgroundColor: props.bgColor ?? `rgba(${r}, ${g}, ${b}, 0.10)`,
  };
});
</script>

<template>
  <div class="wd-info-badge" :style="bgStyle">
    <q-icon v-if="icon" :name="icon" size="24px" class="wd-info-badge__icon" />
    <div class="wd-info-badge__text">
      <div v-if="label" class="wd-info-badge__label">
        {{ label }}
      </div>
      <div class="wd-info-badge__content">
        <slot />
      </div>
    </div>
    <slot name="append" />
  </div>
</template>

<style lang="scss" scoped>
.wd-info-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 4px 6px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-left: 6px solid;
  border-radius: 6px;
}

.wd-info-badge__icon {
  flex-shrink: 0;
}

.wd-info-badge__text {
  min-width: 0;
  line-height: 1;
  flex: 1;
}

.wd-info-badge__label {
  font-size: 0.5rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #888;
  line-height: 1;
}

.wd-info-badge__content {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #346751;
  font-size: 0.8rem;
  line-height: 1.2;
}
</style>
