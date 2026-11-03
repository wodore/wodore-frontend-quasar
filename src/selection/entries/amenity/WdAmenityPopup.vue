<script setup lang="ts">
/**
 * Amenity popup — the minimal content for amenity-subtree targets
 * (name, type icon, elevation; owner decision 2026-11). Instant paint
 * from tile properties, enrichment from the geoplace detail:
 *
 * - name: the popup SHELL's title strip owns it when the tiles carry
 *   one (label zooms); below that the tile name is empty and this
 *   content owns the name row, localized from the detail fetch.
 * - icon: `category_identifier` tile prop (backend tile-fields PR) →
 *   detail kind symbol → color-swatch fallback (the marker's own color
 *   — better than a wrong generic icon; degrades gracefully today).
 * - elevation: tile `elevation` (backend PR) → detail elevation → row
 *   hidden when absent.
 */
import { computed, ref, watch, onScopeDispose } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MapTarget } from '@selection/types';
import WdCategoryIcon from '@components/categories/WdCategoryIcon.vue';
import { fetchAmenityDetail, type AmenityDetail } from './fetch';

const props = defineProps<{ target: MapTarget }>();
const { locale } = useI18n();

const p = computed(() => props.target.props as Record<string, unknown>);

/** Tile identity (instant): localized name family first, plain after. */
const tileName = computed(() => {
  const raw = p.value[`name_${locale.value}`] ?? p.value.name;
  return typeof raw === 'string' ? raw : '';
});
const tileElevation = computed(() => {
  const n = Number(p.value.elevation);
  return Number.isFinite(n) && p.value.elevation !== null && p.value.elevation !== undefined
    ? n
    : null;
});
const tileIdentifier = computed(() =>
  typeof p.value.category_identifier === 'string' ? p.value.category_identifier : null
);
/** Marker color for the icon-less fallback swatch. */
const tileColor = computed(() => {
  const raw = p.value.color ?? p.value.parent_color;
  return typeof raw === 'string' && raw ? raw : null;
});

// ── Detail enrichment (name below label zoom, elevation, kind icon) ──
const detail = ref<AmenityDetail | null>(null);
const loading = ref(false);
const failed = ref(false);
let controller: AbortController | null = null;

watch(
  [() => props.target.id, locale],
  ([slug]) => {
    if (controller) controller.abort();
    detail.value = null;
    failed.value = false;
    if (!slug) return;
    controller = new AbortController();
    loading.value = true;
    fetchAmenityDetail({ id: String(slug), lang: locale.value, signal: controller.signal })
      .then(data => {
        detail.value = data;
      })
      .catch(() => {
        // Props-only degrade: the popup stays usable without the detail
        // (offline, endpoint hiccup) — never a dead card.
        failed.value = true;
      })
      .finally(() => {
        loading.value = false;
      });
  },
  { immediate: true }
);

onScopeDispose(() => controller?.abort());

const name = computed(() => detail.value?.name || tileName.value || null);
/** The shell strip carries the name when the tiles have one — avoid
 *  duplicating it in the content below. */
const ownsNameRow = computed(() => !tileName.value);
const elevation = computed(() => tileElevation.value ?? detail.value?.elevation ?? null);
const kindName = computed(() => detail.value?.kind?.name ?? null);

/** Icon chain: tile category identifier → detail kind symbol/identifier
 *  → color-swatch fallback (no wrong icons, never blank). */
const iconIdentifier = computed(
  () => tileIdentifier.value ?? detail.value?.kind?.identifier ?? null
);
const iconHref = computed(() => detail.value?.kind?.symbol?.color ?? null);
</script>

<template>
  <div class="wd-am-popup">
    <div class="row items-center no-wrap q-gutter-x-sm">
      <WdCategoryIcon
        v-if="iconIdentifier || iconHref"
        :identifier="iconIdentifier ?? 'amenity.place'"
        :href="iconHref"
        variant="color"
        :size="28"
      />
      <!-- Fallback: the marker's own color as a swatch dot -->
      <span
        v-else-if="tileColor"
        class="wd-am-popup__swatch"
        :style="{ backgroundColor: tileColor }"
      />
      <!-- Name row only when the shell strip cannot carry it (below the
           style's label zoom the tile name is empty). -->
      <span v-if="ownsNameRow" class="wd-am-popup__name">
        <span v-if="name">{{ name }}</span>
        <span v-else-if="loading" class="wd-am-popup__placeholder">&nbsp;</span>
      </span>
    </div>
    <p v-if="kindName || elevation !== null" class="wd-am-popup__meta q-mb-none">
      <span v-if="kindName">{{ kindName }}</span>
      <span v-if="kindName && elevation !== null"> · </span>
      <span v-if="elevation !== null">{{ elevation }} m</span>
    </p>
  </div>
</template>

<style lang="scss" scoped>
.wd-am-popup {
  font-size: 13px;
  line-height: 1.35;
  padding-top: 2px;
  min-width: 0;
}

.wd-am-popup__name {
  flex: 1;
  min-width: 0;
  font-family: 'Barlow Semi Condensed', 'Barlow', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--wd-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Skeleton pulse for the name while the detail resolves (tile name
// empty below label zoom) — matches the map popup chrome's calm tones.
.wd-am-popup__placeholder {
  display: inline-block;
  width: 110px;
  height: 12px;
  border-radius: 4px;
  background: var(--wd-wash);
  animation: wd-am-pulse 1.2s ease-in-out infinite;
}

@keyframes wd-am-pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wd-am-popup__placeholder {
    animation: none;
  }
}

.wd-am-popup__swatch {
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(var(--wd-ink-rgb, 30 30 30), 0.25);
}

.wd-am-popup__meta {
  color: var(--wd-ink-soft, #5c5c5c);
  font-size: 12px;
}
</style>
