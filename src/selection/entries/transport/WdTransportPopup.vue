<script setup lang="ts">
/**
 * Transport stop popup — external-source content (PR3): renders
 * Transitland tile properties defensively (the wire schema is NOT the
 * geoplace model — fail-open: whatever is absent simply doesn't render).
 * Props-ONLY: zero fetch on the open path.
 *
 * Tile schema (transitland_stops MLT, probed from staging tiles):
 * `onestop_id`, `operator_name`, `operator_short_name`, `routes`
 * (JSON string array), `route_types`, `location_type`,
 * `parent_station`. Stop names are sparse in the tiles — the title
 * falls back to operator + stop id.
 */
import { computed } from 'vue';
import type { MapTarget } from '@selection/types';

const props = defineProps<{ target: MapTarget }>();

const p = computed(() => props.target.props as Record<string, unknown>);

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
          typeof route.color === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(route.color)
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
    <p v-if="operator" class="wd-transport-popup__operator q-mb-none">{{ operator }}</p>
    <div v-if="routes.length" class="row q-gutter-xs q-mt-xs">
      <span
        v-for="r in routes"
        :key="r.name ?? ''"
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
  padding-top: 2px;
}

.wd-transport-popup__operator {
  font-size: 12px;
  color: var(--wd-ink-soft, #5c5c5c);
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
