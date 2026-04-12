<script setup lang="ts">
import { computed } from 'vue';
import { date as quasarDate, useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';

const { formatDate } = quasarDate;
const { t } = useI18n();
const $q = useQuasar();

const props = withDefaults(
  defineProps<{
    /** ISO date string (YYYY-MM-DD) */
    date: string;
    /** Whether this day is active/selected (bold name) */
    isActive?: boolean;
  }>(),
  {
    isActive: false,
  }
);

const dateObj = computed(() => new Date(`${props.date}T00:00:00`));

const todayMidnight = computed(() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
});

const dayDiff = computed(() =>
  Math.round((dateObj.value.getTime() - todayMidnight.value.getTime()) / 86400000)
);

const isToday = computed(() => dayDiff.value === 0);

const dayLabel = computed(() => {
  if (dayDiff.value === 0) return t('weather.today');
  if (dayDiff.value === 1) return t('weather.tomorrow');
  if (dayDiff.value === -1) return t('weather.yesterday');
  const locale = $q.lang?.isoName ?? 'de';
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(dateObj.value);
});

const dateLabel = computed(() => {
  return formatDate(dateObj.value, 'DD.MM.');
});
</script>

<template>
  <div class="wd-day-label">
    <div
      class="wd-day-label__name"
      :class="{
        'wd-day-label__name--today': isToday,
        'wd-day-label__name--active': isActive,
      }"
    >
      {{ dayLabel }}
    </div>
    <div class="wd-day-label__date">{{ dateLabel }}</div>
  </div>
</template>

<style scoped lang="scss">
.wd-day-label {
  text-align: center;
  user-select: none;
}

.wd-day-label__name {
  font-size: 11px;
  line-height: 1.2;
  font-weight: 500;
  color: rgba(color('dark'), 0.75);
  white-space: nowrap;
}

.wd-day-label__name--today {
  font-weight: 700;
  color: rgba(color('dark'), 0.95);
}

.wd-day-label__name--active {
  font-weight: 700;
}

.wd-day-label__date {
  font-size: 10px;
  line-height: 1.2;
  color: rgba(color('dark'), 0.5);
  text-align: center;
  margin-bottom: -4px;

  @media (min-width: 600px) {
    font-size: 11px;
  }
}
</style>
