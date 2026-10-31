<script setup lang="ts">
/**
 * Transport stop popup — external-source content (PR3, impeccable pass
 * 2026-10-31). Renders Transitland tile properties defensively (fail-open:
 * whatever is absent doesn't render). Props-ONLY: zero fetch on open.
 *
 * Tile schema (transitland_stops MLT, per the Transitland v2 docs +
 * staging tile probes): `stop_name` (the proper station name!), `stop_id`,
 * `onestop_id`, `operator_short_name`/`operator_name`, `route_types_basic`
 * (JSON number array — GTFS basic types 0-7/11/12), `routes` (JSON array
 * with route_short_name/route_long_name/route_color/route_type_basic).
 *
 * Basic type → category mapping (owner 2026-10-31): the Transitland basic
 * names ARE our category slugs — transport.tram, transport.metro,
 * transport.rail, transport.bus, transport.ferry, transport.cablecar,
 * transport.gondola, transport.funicular, transport.trolleybus,
 * transport.monorail (lowercase). Icons from WdCategoryIcon on those
 * identifiers (CDN symbols, degrade silently until served).
 */
import { computed } from 'vue';
import { copyToClipboard } from 'quasar';
import type { MapTarget } from '@selection/types';
import WdCategoryIcon from '@components/categories/WdCategoryIcon.vue';

const props = defineProps<{ target: MapTarget }>();

const p = computed(() => props.target.props as Record<string, unknown>);

/** Proper station name — `stop_name` from the tiles (Transitland stop
 *  schema). Fallback: the onestop_id slug (capitalized, hyphens as
 *  spaces) for older tiles without the field. */
const stopName = computed(() => {
  const raw = p.value.stop_name;
  if (typeof raw === 'string' && raw) return raw;
  const id = p.value.onestop_id;
  if (typeof id !== 'string') return null;
  const slug = id.split('-').slice(2).join(' ');
  if (!slug) return null;
  return slug.charAt(0).toUpperCase() + slug.slice(1);
});

/** Copy pattern matches the location row in WdPlaceContent (owner
 *  reference): silent copyToClipboard + the fa6 copy icon. */
function copyName(): void {
  if (!stopName.value) return;
  void copyToClipboard(stopName.value);
}

const operator = computed(() => {
  const short = p.value.operator_short_name;
  if (typeof short === 'string' && short) return short;
  const name = p.value.operator_name;
  if (typeof name === 'string' && name) return name;
  return null;
});

/** GTFS basic route type → category (owner: Transitland basic names ARE
 *  our transport.* slugs, lowercase). */
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

interface Mode {
  label: string;
  category: string;
}

const modes = computed<Mode[]>(() => {
  const codes = parseJsonArray(p.value.route_types_basic).filter(
    (c): c is number => typeof c === 'number'
  );
  const seen = new Set<string>();
  const found: Mode[] = [];
  for (const code of codes) {
    const slug = BASIC_TYPE_TO_CATEGORY[code];
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    found.push({ label: slug, category: `transport.${slug}` });
  }
  return found.slice(0, 3);
});

const leadMode = computed(() => modes.value[0] ?? null);

interface RouteInfo {
  name: string;
  color: string | null;
  basic: number | null;
}

/** Routes ride as a JSON-string array — parse defensively, cap the chips. */
const routes = computed<RouteInfo[]>(() => {
  const raw = parseJsonArray(p.value.routes)
    .slice(0, 5)
    .map(r => {
      const route = r as {
        route_short_name?: unknown;
        route_long_name?: unknown;
        route_color?: unknown;
        route_type_basic?: unknown;
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
      const basic =
        typeof route.route_type_basic === 'number' ? route.route_type_basic : null;
      return { name, color, basic };
    })
    .filter((r): r is RouteInfo => r !== null);
  return raw;
});

/** The route chip color — the route's own color when it has one, else
 *  the chip falls back to the design-language tonal treatment. */
function chipStyle(route: RouteInfo): Record<string, string> {
  if (!route.color) return {};
  // Lighten check: a near-white route_color renders invisible on the
  // light panel — fall back to the tonal treatment instead.
  const hex = route.color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (r + g + b > 660) return {}; // too light — tonal fallback
  return { borderColor: route.color, color: route.color };
}
</script>

<template>
  <div class="wd-tp">
    <!-- Name row: icon + station name + copy -->
    <div v-if="leadMode || stopName" class="wd-tp__name-row">
      <WdCategoryIcon
        v-if="leadMode"
        :identifier="leadMode.category"
        variant="color"
        :size="24"
        class="wd-tp__icon"
      />
      <div class="wd-tp__name-col">
        <span class="wd-tp__name">{{ stopName }}</span>
        <div v-if="operator || modes.length" class="wd-tp__meta">
          <span v-if="operator" class="wd-tp__operator">{{ operator }}</span>
          <span v-for="m in modes" :key="m.category" class="wd-tp__mode-tag">
            {{ m.label }}
          </span>
        </div>
      </div>
      <q-btn
        v-if="stopName"
        dense
        flat
        round
        size="8px"
        class="wd-tp__copy"
        aria-label="Copy station name"
        @click="copyName"
      >
        <q-icon size="10px">
          <IconFa6SolidCopy />
        </q-icon>
      </q-btn>
    </div>

    <!-- Route chips -->
    <div v-if="routes.length" class="wd-tp__chips">
      <span
        v-for="(r, i) in routes"
        :key="r.name + ':' + i"
        class="wd-tp__chip"
        :style="chipStyle(r)"
      >
        {{ r.name }}
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Design language (DESIGN.md): tonal panels (--wd-surface bg set by the
// shell), Barlow Semi Condensed labels, info-turquoise accent, 6px chip
// radius, no shadows — the shell handles the card chrome. Compact
// instrument geometry; the popup is a glanceable answer, not a page.
.wd-tp {
  font-size: 13px;
  line-height: 1.35;
  padding: 0 2px;
  min-width: 0;
}

.wd-tp__name-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.wd-tp__icon {
  flex: none;
  margin-top: 1px;
}

.wd-tp__name-col {
  flex: 1;
  min-width: 0;
}

.wd-tp__name {
  display: block;
  font-family: 'Barlow Semi Condensed', 'Barlow', sans-serif;
  font-weight: 600;
  font-size: 14px;
  line-height: 1.2;
  color: var(--wd-ink, #1c1c1c);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wd-tp__meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 2px;
}

.wd-tp__operator {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--wd-ink-soft, #29626b);
}

.wd-tp__mode-tag {
  font-size: 11px;
  color: var(--wd-info, #29626b);
  text-transform: lowercase;
}

.wd-tp__copy {
  flex: none;
  margin-top: 2px;
  color: var(--wd-ink-soft, #29626b);
  opacity: 0.7;

  &:hover,
  &:focus {
    opacity: 1;
  }
}

.wd-tp__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

// Design-language chip: tonal fill, 6px radius; route colors override
// border+text when readable against the panel (chipStyle lightens check).
.wd-tp__chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 6px;
  font-family: 'Barlow Semi Condensed', 'Barlow', sans-serif;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
  background: var(--wd-wash, rgba(0, 0, 0, 0.06));
  color: var(--wd-info, #29626b);
  border: 1px solid transparent;
}
</style>
