<script setup lang="ts">
/**
 * Transport stop popup — external-source content (PR3, impeccable pass 3
 * per Opus UX spec 2026-11-01). Renders Transitland tile properties
 * defensively (fail-open). Props-ONLY: zero fetch on open.
 *
 * Three-row title grammar (hut-title pattern, WdPlaceTitle):
 *   [avatar]  TYPE · OVERLINE          ← route_types_basic → transport.*
 *            Station Name       [copy] ← stop_name
 *            Operator (tooltip)         ← operator_short_name
 * Route pills below: [swatch] NUMBER — swatch is a vertical color
 * rect, number stays ink (the swatch owns the color).
 */
import { computed, ref } from 'vue';
import { copyToClipboard } from 'quasar';
import type { MapTarget } from '@selection/types';
import WdCategoryIcon from '@components/categories/WdCategoryIcon.vue';

const props = defineProps<{ target: MapTarget }>();

const p = computed(() => props.target.props as Record<string, unknown>);

// ── Name ────────────────────────────────────────────────────────────────

const stopName = computed(() => {
  const raw = p.value.stop_name;
  if (typeof raw === 'string' && raw) return raw;
  const id = p.value.onestop_id;
  if (typeof id !== 'string') return null;
  const slug = id.split('-').slice(2).join(' ');
  if (!slug) return null;
  return slug.charAt(0).toUpperCase() + slug.slice(1);
});

function copyName(): void {
  if (!stopName.value) return;
  void copyToClipboard(stopName.value);
}

// ── Operator ────────────────────────────────────────────────────────────

const operatorShort = computed(() => {
  const raw = p.value.operator_short_name;
  return typeof raw === 'string' && raw ? raw : null;
});

const operatorFull = computed(() => {
  const raw = p.value.operator_name;
  return typeof raw === 'string' && raw ? raw : null;
});

const operatorLabel = computed(() => operatorShort.value ?? operatorFull.value);

// ── Modes (route_types_basic → transport.* categories) ─────────────────

const BASIC_TYPE_TO_CATEGORY: Record<number, string> = {
  0: 'tram',
  1: 'metro',
  2: 'rail',
  3: 'bus',
  4: 'ferry',
  5: 'cablecar',
  6: 'gondola',
  7: 'funicular',
  11: 'trolleybus',
  12: 'monorail',
};

function parseJsonArray(raw: unknown): unknown[] {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
}

const modes = computed(() => {
  const codes = parseJsonArray(p.value.route_types_basic).filter(
    (c): c is number => typeof c === 'number'
  );
  const seen = new Set<string>();
  const found: string[] = [];
  for (const code of codes) {
    const slug = BASIC_TYPE_TO_CATEGORY[code];
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    found.push(slug);
  }
  return found.slice(0, 3);
});

const leadMode = computed(() => (modes.value.length > 0 ? modes.value[0] : null));
const leadCategory = computed(() => (leadMode.value ? `transport.${leadMode.value}` : null));
const modeOverline = computed(() => modes.value.join(' · '));

// ── Route pills ─────────────────────────────────────────────────────────

interface RouteInfo {
  name: string;
  color: string | null;
}

const ROUTE_PILL_CAP = 4;

const routes = computed<RouteInfo[]>(() => {
  const all = parseJsonArray(p.value.routes)
    .map(r => {
      const route = r as {
        route_short_name?: unknown;
        route_long_name?: unknown;
        route_color?: unknown;
      };
      const name =
        (typeof route.route_short_name === 'string' && route.route_short_name) ||
        (typeof route.route_long_name === 'string' && route.route_long_name) ||
        null;
      if (!name) return null;
      const color =
        typeof route.route_color === 'string' &&
        /^(?:#?[0-9a-fA-F]{3,4}|#?[0-9a-fA-F]{6}|#?[0-9a-fA-F]{8})$/.test(route.route_color)
          ? route.route_color.startsWith('#')
            ? route.route_color
            : `#${route.route_color}`
          : null;
      return { name, color };
    })
    .filter((r): r is RouteInfo => r !== null);

  // Dedup by name, keep the first color seen (Transitland repeats
  // routes per direction/segment at hubs like Zürich HB — 64 pills
  // collapse to ~20 unique). Count occurrences, sort by frequency
  // (most-served first) then alphabetically.
  const byName = new Map<string, RouteInfo & { count: number }>();
  for (const route of all) {
    const existing = byName.get(route.name);
    if (existing) {
      existing.count++;
      if (!existing.color && route.color) existing.color = route.color;
    } else {
      byName.set(route.name, { ...route, count: 1 });
    }
  }
  return [...byName.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map(({ name, color }) => ({ name, color }));
});

const showAllRoutes = ref(false);
const visibleRoutes = computed(() => {
  if (showAllRoutes.value || routes.value.length <= ROUTE_PILL_CAP) return routes.value;
  return routes.value.slice(0, ROUTE_PILL_CAP);
});
const hiddenRouteCount = computed(() =>
  routes.value.length > ROUTE_PILL_CAP && !showAllRoutes.value
    ? routes.value.length - ROUTE_PILL_CAP
    : 0
);

/** Swatch color: the route's own color; falls back to ink-soft when the
 *  color is too light to see on the panel (existing lighten test). */
function swatchColor(route: RouteInfo): string {
  if (!route.color) return 'var(--wd-ink-soft)';
  const hex = route.color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (r + g + b > 660) return 'var(--wd-ink-soft)'; // too light
  return route.color;
}
</script>

<template>
  <div class="wd-tp">
    <!-- Three-row title: avatar | overline/name/operator -->
    <div class="wd-tp__head">
      <div v-if="leadCategory" class="wd-tp__avatar">
        <WdCategoryIcon :identifier="leadCategory" variant="color" :size="32" />
      </div>
      <div class="wd-tp__col">
        <!-- Row 1: type overline -->
        <div v-if="modeOverline" class="wd-tp__overline">{{ modeOverline }}</div>
        <!-- Row 2: station name + copy -->
        <div v-if="stopName" class="wd-tp__name-row">
          <span class="wd-tp__name">{{ stopName }}</span>
          <q-btn
            dense
            flat
            round
            size="7px"
            class="wd-tp__copy"
            aria-label="Copy station name"
            @click="copyName"
          >
            <q-icon size="13px">
              <IconFa6SolidCopy />
            </q-icon>
          </q-btn>
        </div>
        <!-- Row 3: operator with tooltip -->
        <div v-if="operatorLabel" class="wd-tp__operator">
          {{ operatorLabel }}
          <q-tooltip v-if="operatorFull && operatorFull !== operatorLabel" :delay="300">
            {{ operatorFull }}
          </q-tooltip>
        </div>
      </div>
    </div>

    <!-- Route pills: [swatch] NUMBER -->
    <div v-if="visibleRoutes.length" class="wd-tp__routes">
      <span v-for="r in visibleRoutes" :key="r.name" class="wd-tp__pill">
        <span class="wd-tp__swatch" :style="{ background: swatchColor(r) }" />
        {{ r.name }}
      </span>
      <button
        v-if="hiddenRouteCount > 0"
        type="button"
        class="wd-tp__pill wd-tp__pill--more"
        @click="showAllRoutes = true"
      >
        +{{ hiddenRouteCount }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// ── Three-row title (hut-title grammar) ────────────────────────────────
.wd-tp {
  min-width: 0;
  font-size: 13px;
  line-height: 1.35;
}

.wd-tp__head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.wd-tp__avatar {
  flex: none;
  align-self: center; // vertically center against the full 3-row text block
}

.wd-tp__col {
  flex: 1;
  min-width: 0;
  padding-right: 32px; // clears the absolute close + breathing room
}

// Row 1: type overline
.wd-tp__overline {
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

// Row 2: name + copy
.wd-tp__name-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.wd-tp__name {
  flex: 1;
  min-width: 0;
  font-family: 'Barlow Semi Condensed', 'Barlow', sans-serif;
  font-size: 15px;
  font-weight: 600;
  color: var(--wd-ink);
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wd-tp__copy {
  flex: none;
  color: var(--wd-ink-soft);
  opacity: 0.6;

  &:hover,
  &:focus {
    opacity: 1;
  }
}

// Row 3: operator
.wd-tp__operator {
  font-family: 'Barlow', sans-serif;
  font-size: 12px;
  color: var(--wd-ink-soft);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// ── Route pills ─────────────────────────────────────────────────────────
.wd-tp__routes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
  max-height: 96px; // ~3 rows — larger sets scroll (Zurich HB: 20+ routes)
  overflow-y: auto;
  overscroll-behavior: contain;
}

.wd-tp__pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 7px;
  border-radius: 6px;
  font-family: 'Barlow Semi Condensed', 'Barlow', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: var(--wd-ink);
  background: var(--wd-wash);
  border: 1px solid transparent;
  line-height: 1;
}

// Vertical color swatch (width < height per owner spec)
.wd-tp__swatch {
  width: 6px;
  height: 14px;
  border-radius: 3px;
  flex: none;
}

// "+k" reveal button
.wd-tp__pill--more {
  cursor: pointer;
  color: var(--wd-info);
}
</style>
