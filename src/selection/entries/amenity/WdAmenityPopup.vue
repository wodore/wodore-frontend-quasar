<script setup lang="ts">
/**
 * Amenity popup — the minimal content for amenity-subtree targets
 * (type, name, elevation; owner decision 2026-11), laid out in the
 * transport-popup grammar (the hut-title pattern):
 *
 *   [ICON]  TYPE · 1234 m      ← eyebrow (small, uppercase, muted)
 *           NAME               ← large/bold — only when the shell's
 *                                title strip does not already own it
 *
 * - The shell strip carries the name when the tiles have one (label
 *   zooms) — the content then renders icon + eyebrow only (no double
 *   name). Below label zoom the tile name is empty and this content
 *   owns the name row, localized from the detail fetch.
 * - No name anywhere: the type label becomes the NAME row and the
 *   eyebrow is dropped (never the same string twice).
 * - icon chain: `category_identifier` tile prop (backend tile-fields
 *   PR) → detail kind symbol → color-swatch fallback (the marker's own
 *   color — better than a wrong generic icon; degrades gracefully
 *   today).
 * - elevation: tile `elevation` (backend PR) → detail elevation → the
 *   eyebrow dot separator only when present.
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

// ── Rows ──────────────────────────────────────────────────────────────
const name = computed(() => detail.value?.name || tileName.value || null);

/** The shell strip owns the name when the tiles carry one — this
 *  content must not double-render it. */
const shellOwnsName = computed(() => Boolean(tileName.value));

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

/** No name anywhere (after settle) → the type becomes the NAME (and
 *  the eyebrow is dropped — never the same string twice); while the
 *  detail is still resolving below label zoom, the name row shows the
 *  skeleton instead. */
const nameRow = computed(() => name.value ?? (loading.value ? null : typeLabel.value));
const showNameRow = computed(() => !shellOwnsName.value && Boolean(nameRow.value || loading.value));
const eyebrow = computed(() => {
  if (!name.value && nameRow.value && nameRow.value === typeLabel.value) return null;
  return typeLabel.value;
});

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
        <!-- Row 2: NAME (owned here only when the shell strip lacks it;
             skeleton while the detail resolves below label zoom) -->
        <div v-if="showNameRow" class="wd-am-popup__name-row">
          <span v-if="nameRow" class="wd-am-popup__name">{{ nameRow }}</span>
          <span v-else-if="loading" class="wd-am-popup__placeholder">&nbsp;</span>
        </div>
      </div>
    </div>
    <!-- Geo link, bottom-right (the cluster anchor / tap position) -->
    <div v-if="anchor" class="wd-am-popup__footer">
      <WdGeoLink :lat="anchor.lat" :lon="anchor.lon" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.wd-am-popup {
  font-size: 13px;
  line-height: 1.35;
  padding-top: 2px;
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

// ── Footer: geo link, bottom-right ───────────────────────────────────
.wd-am-popup__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}
</style>
