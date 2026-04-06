<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  color?: string;
  bgColor?: string;
  icon?: string;
  label?: string;
  stat?: string | number;
}

const props = withDefaults(defineProps<Props>(), {
  color: '#346751',
  bgColor: undefined,
});

const isZero = computed(() => props.stat === 0 || props.stat === '0');

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
    <q-icon v-if="icon" :name="icon" size="22px" class="wd-info-badge__icon" />
    <div class="wd-info-badge__text">
      <div v-if="label" class="wd-info-badge__label">
        {{ label }}
      </div>
      <div class="wd-info-badge__content">
        <slot />
      </div>
    </div>
    <div v-if="stat != null" class="wd-info-badge__stat">
      <q-icon
        :name="isZero ? 'wd-no-bed-flat' : 'wd-bed-flat'"
        :size="isZero ? '16px' : '16px'"
        class="wd-info-badge__stat-icon"
      />
      <span v-if="!isZero" class="wd-info-badge__stat-value">{{ stat }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.wd-info-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 6px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-left: 4px solid;
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
  font-size: 0.6rem;
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

.wd-info-badge__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  min-width: 32px;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  gap: 0;
}

.wd-info-badge__stat-value {
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.1;
  color: #346751;
  font-variant-numeric: tabular-nums;
}

.wd-info-badge__stat-icon {
  color: #777;
}
</style>
