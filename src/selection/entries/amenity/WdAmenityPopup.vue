<script setup lang="ts">
/**
 * Amenity popup — transport-popup grammar (owner 2026-11, review pass 2):
 *
 *   [ICON]  TYPE · 1234 m      ← eyebrow (small, uppercase, muted)
 *           NAME               ← title (large/bold)
 *
 * The popup OWNS the name (entry declares popupOwnsTitle — the shell
 * renders no title strip): instant from tile properties, localized
 * overwrite from the geoplace detail when it resolves. No name
 * anywhere (after settle) → the type label becomes the title and the
 * eyebrow drops (never the same string twice).
 *
 * - icon chain: `category_identifier` tile prop (backend tile-fields
 *   PR) → detail kind symbol → color-swatch fallback (the marker's own
 *   color — better than a wrong generic icon; degrades gracefully
 *   today).
 * - elevation: tile `elevation` (backend PR) → detail elevation → the
 *   eyebrow's `· elevation` part hidden when absent.
 * - geo link: absolute bottom-right of the card, zero flow space.
 */
import { computed, ref, watch, onScopeDispose } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MapTarget } from '@selection/types';
import WdCategoryIcon from '@components/categories/WdCategoryIcon.vue';
import WdGeoLink from '@components/map/WdGeoLink.vue';
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

// ── Detail enrichment (localized name, elevation, kind icon) ────────
const detail = ref<AmenityDetail | null>(null);
const loading = ref(false);
let controller: AbortController | null = null;

watch(
  [() => props.target.id, locale],
  ([slug]) => {
    if (controller) controller.abort();
    detail.value = null;
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
      })
      .finally(() => {
        loading.value = false;
      });
  },
  { immediate: true }
);

onScopeDispose(() => controller?.abort());

// ── Rows ──────────────────────────────────────────────────────────────
const name = computed(() => detail.value?.name || tileName.value || null);

/** Type eyebrow: the detail's localized kind name; readable fallback
 *  from the identifier slug part ('restaurant.pizza' → 'Pizza'). */
const typeLabel = computed(() => {
  const kindName = detail.value?.kind?.name;
  if (kindName) return kindName;
  const identifier = tileIdentifier.value ?? detail.value?.kind?.identifier;
  if (!identifier) return null;
  const slug = identifier.split('.').slice(1).join('.') || identifier;
  return slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, ' ');
});

/** Title row: NAME; empty (after settle) → the type stands in, and the
 *  eyebrow drops (never the same string twice). While the detail is in
 *  flight below label zoom, the row shows the skeleton. */
const titleRow = computed(() => name.value ?? (loading.value ? null : typeLabel.value));
const showTitleRow = computed(() => Boolean(titleRow.value || loading.value));
const eyebrow = computed(() =>
  !name.value && titleRow.value && titleRow.value === typeLabel.value ? null : typeLabel.value
);

const elevation = computed(() => tileElevation.value ?? detail.value?.elevation ?? null);

/** Icon chain: tile category identifier → detail kind symbol/identifier
 *  → color-swatch fallback (no wrong icons, never blank). */
const iconIdentifier = computed(
  () => tileIdentifier.value ?? detail.value?.kind?.identifier ?? null
);
const iconHref = computed(() => detail.value?.kind?.symbol?.color ?? null);
const showSwatch = computed(
  () => !iconIdentifier.value && !iconHref.value && Boolean(tileColor.value)
);

const anchor = computed(() => props.target.location);
</script>

<template>
  <div class="wd-am-popup">
    <div class="wd-am-popup__head">
      <div class="wd-am-popup__avatar">
        <WdCategoryIcon
          v-if="iconIdentifier || iconHref"
          :identifier="iconIdentifier ?? 'amenity.place'"
          :href="iconHref"
          variant="color"
          :size="32"
        />
        <!-- Fallback: the marker's own color as a swatch dot -->
        <span
          v-else-if="showSwatch"
          class="wd-am-popup__swatch"
          :style="{ backgroundColor: tileColor! }"
        />
      </div>
      <div class="wd-am-popup__col">
        <!-- Row 1: type eyebrow · elevation -->
        <div v-if="eyebrow || elevation !== null" class="wd-am-popup__overline">
          <span v-if="eyebrow">{{ eyebrow }}</span>
          <span v-if="eyebrow && elevation !== null"> · </span>
          <span v-if="elevation !== null">{{ elevation }} m</span>
        </div>
        <!-- Row 2: NAME (skeleton while the detail resolves below label
             zoom) -->
        <div v-if="showTitleRow" class="wd-am-popup__name-row">
          <span v-if="titleRow" class="wd-am-popup__name">{{ titleRow }}</span>
          <span v-else-if="loading" class="wd-am-popup__placeholder">&nbsp;</span>
        </div>
      </div>
    </div>
    <!-- Geo link: absolute bottom-right, no flow space -->
    <WdGeoLink v-if="anchor" class="wd-am-popup__geo" :lat="anchor.lat" :lon="anchor.lon" />
  </div>
</template>

<style lang="scss" scoped>
.wd-am-popup {
  position: relative; // anchors the absolute geo link
  font-size: 13px;
  line-height: 1.35;
  padding: 2px 0 2px;
  min-width: 0;
}

// ── Head: icon left, text stack right (transport-popup grammar) ─────
.wd-am-popup__head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.wd-am-popup__avatar {
  flex: none;
  align-self: center; // vertically center against the text block
}

.wd-am-popup__col {
  flex: 1;
  min-width: 0;
  padding-right: 8px; // clears the shell's floating sr-only close focus
}

// Row 1: type eyebrow · elevation
.wd-am-popup__overline {
  font-family: 'Barlow Semi Condensed', 'Barlow', sans-serif;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--wd-ink-soft);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Row 2: NAME
.wd-am-popup__name-row {
  display: flex;
  align-items: center;
}

.wd-am-popup__name {
  font-family: 'Barlow Semi Condensed', 'Barlow', sans-serif;
  font-size: 15px;
  font-weight: 600;
  color: var(--wd-ink);
  line-height: 1.25;
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
  display: inline-flex;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(var(--wd-ink-rgb, 30 30 30), 0.25);
}

// ── Geo link: absolute bottom-right, zero flow space ────────────────
.wd-am-popup__geo {
  position: absolute;
  right: 0;
  bottom: 0;
}
</style>
