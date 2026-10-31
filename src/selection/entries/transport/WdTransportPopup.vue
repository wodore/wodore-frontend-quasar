<script setup lang="ts">
/**
 * Transport stop popup — external-source content (PR3, impeccable pass
 * 2026-10-31). Renders Transitland tile properties defensively (the wire
 * schema is NOT the geoplace model — fail-open: whatever is absent simply
 * doesn't render). Props-ONLY: zero fetch on the open path.
 *
 * Tile schema (transitland_stops MLT, probed from staging tiles): NO stop
 * `name` member (backend gap — the display name derives from the
 * onestop_id slug), `stop_id`, `operator_name`/`operator_short_name`/
 * `operator_onestop_id`, `routes` (JSON string array with short/long name
 * + color), `route_types` (JSON number array, NeTEx codes), `agencies`,
 * `location_type`, `parent_station`, admin regions. No elevation.
 *
 * Category icons (owner): /v1/categories/symbol/{variant}/transport/*.svg
 * — verified NOT served on staging yet (404, same breakage as the
 * transport category list): WdCategoryIcon degrades silently and the mode
 * LABEL carries the meaning until the symbols ship.
 */
import { computed } from 'vue';
import { copyToClipboard } from 'quasar';
import type { MapTarget } from '@selection/types';
import WdCategoryIcon from '@components/categories/WdCategoryIcon.vue';

const props = defineProps<{ target: MapTarget }>();

const p = computed(() => props.target.props as Record<string, unknown>);

/** Display name: a real name member when the tiles ever carry one,
 *  else the onestop_id slug (s-u0q-sk28-saillon-clos-d-avaux →
 *  Saillon clos d avaux) — capitalized, hyphens read as spaces. */
const stopName = computed(() => {
  const raw = p.value.name;
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

/** NeTEx route-type code → mode (label + category icon slug). */
interface Mode {
  label: string;
  icon: string;
}
const MODES: Array<{ test: (code: number) => boolean; mode: Mode }> = [
  { test: c => c === 0 || (c >= 900 && c < 1000), mode: { label: 'Tram', icon: 'transport.tram' } },
  { test: c => c === 1 || (c >= 400 && c < 500), mode: { label: 'Metro', icon: 'transport.metro' } },
  {
    test: c => c === 2 || (c >= 100 && c < 200),
    mode: { label: 'Train', icon: 'transport.train' },
  },
  { test: c => c === 1000 || (c >= 1000 && c < 1100), mode: { label: 'Ferry', icon: 'transport.ferry' } },
  { test: c => c >= 1300, mode: { label: 'Cableway', icon: 'transport.cableway' } },
  { test: c => c === 3 || (c >= 700 && c < 800) || c === 11, mode: { label: 'Bus', icon: 'transport.bus' } },
];

const modes = computed<Mode[]>(() => {
  const raw = p.value.route_types;
  let codes: number[] = [];
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) codes = parsed.filter(c => typeof c === 'number');
    } catch {
      codes = [];
    }
  } else if (Array.isArray(raw)) {
    codes = raw.filter(c => typeof c === 'number');
  }
  const found: Mode[] = [];
  for (const code of codes) {
    const hit = MODES.find(m => m.test(code));
    if (hit && !found.some(f => f.label === hit.mode.label)) found.push(hit.mode);
  }
  return found.slice(0, 3);
});

/** Primary mode — keys the leading icon. */
const leadMode = computed(() => modes.value[0] ?? null);

const operator = computed(() => {
  const short = p.value.operator_short_name;
  if (typeof short === 'string' && short) return short;
  const name = p.value.operator_name;
  if (typeof name === 'string' && name) return name;
  return null;
});

interface RouteInfo {
  name: string | null;
  color: string | null;
}

/** Routes ride as a JSON-string array in the tiles — parse defensively,
 *  cap the chips. */
const routes = computed<RouteInfo[]>(() => {
  const raw = p.value.routes;
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .slice(0, 4)
      .map(r => {
        const route = r as { long_name?: unknown; short_name?: unknown; color?: unknown };
        const name =
          (typeof route.short_name === 'string' && route.short_name) ||
          (typeof route.long_name === 'string' && route.long_name) ||
          null;
        const color =
          typeof route.color === 'string' &&
          /^(?:#?[0-9a-fA-F]{3,4}|#?[0-9a-fA-F]{6}|#?[0-9a-fA-F]{8})$/.test(route.color)
            ? route.color.startsWith('#')
              ? route.color
              : `#${route.color}`
            : null;
        return { name, color };
      })
      .filter(r => r.name);
  } catch {
    return [];
  }
});
</script>

<template>
  <div class="wd-transport-popup">
    <div v-if="leadMode || stopName" class="row items-center no-wrap q-mb-xs">
      <WdCategoryIcon
        v-if="leadMode"
        :identifier="leadMode.icon"
        variant="color"
        :size="22"
        class="q-mr-xs"
      />
      <span class="wd-transport-popup__name text-ellipsis">{{ stopName }}</span>
      <q-btn
        v-if="stopName"
        dense
        flat
        round
        size="8px"
        class="wd-transport-popup__copy"
        aria-label="Copy"
        @click="copyName"
      >
        <q-icon size="10px">
          <IconFa6SolidCopy />
        </q-icon>
      </q-btn>
    </div>
    <div v-if="modes.length || operator" class="wd-transport-popup__meta">
      <span v-if="operator" class="wd-transport-popup__operator">{{ operator }}</span>
      <span v-if="operator && modes.length" class="wd-transport-popup__dot">·</span>
      <span v-for="m in modes" :key="m.label" class="wd-transport-popup__mode">{{ m.label }}</span>
    </div>
    <div v-if="routes.length" class="row q-gutter-xs q-mt-xs">
      <span
        v-for="(r, i) in routes"
        :key="(r.name ?? '') + ':' + i"
        class="wd-transport-popup__chip"
        :style="r.color ? { borderColor: r.color, color: r.color } : undefined"
      >
        {{ r.name }}
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.wd-transport-popup {
  font-size: 13px;
  line-height: 1.35;
  padding-top: 2px;
  min-width: 0;
}

.wd-transport-popup__name {
  font-weight: 600;
  color: var(--wd-ink, #1a1a1a);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wd-transport-popup__copy {
  flex: none;
  color: var(--wd-ink-soft, #5c5c5c);
}

.wd-transport-popup__meta {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: var(--wd-ink-soft, #5c5c5c);
  font-size: 12px;
}

.wd-transport-popup__operator {
  font-weight: 500;
}

.wd-transport-popup__dot {
  opacity: 0.6;
}

.wd-transport-popup__mode {
  text-transform: capitalize;
}

.wd-transport-popup__chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border: 1px solid currentColor;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}
</style>
