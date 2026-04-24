<script setup lang="ts">
interface Props {
  icon?: string;
  zeroIcon?: string;
  zero?: boolean;
}

withDefaults(defineProps<Props>(), {
  icon: undefined,
  zeroIcon: undefined,
  zero: false,
});
</script>

<template>
  <div class="wd-stat-box">
    <q-icon v-if="zero && zeroIcon" :name="zeroIcon" size="16px" class="wd-stat-box__icon" />
    <template v-else-if="icon">
      <q-icon :name="icon" size="16px" class="wd-stat-box__icon" />
      <span v-if="!zero" class="wd-stat-box__value">
        <slot />
      </span>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.wd-stat-box {
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

.wd-stat-box__icon {
  color: #777;
}

.wd-stat-box__value {
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 0.8;
  color: #346751;
  font-variant-numeric: tabular-nums;
}
</style>
