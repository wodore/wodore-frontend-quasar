<script setup lang="ts">
/**
 * Cluster popup — the member list for a small server-side cluster
 * (count < 6; bigger clusters zoom in instead, decided in the map
 * adapter). Members are NOT in the tiles (abandoned contract — tile
 * size); they are fetched from the spatial near endpoint around the
 * cluster anchor while a small spinner runs.
 *
 * Lives in components/map (NOT under selection/entries — entries are
 * store-free by lint boundary): clicking a member dispatches through
 * the selection store exactly like an individual symbol click, with the
 * CLUSTER's anchor as the popup location (member positions are unknown
 * client-side; the near query orders members around that anchor).
 */
import { computed, ref, watch, onScopeDispose } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSelectionStore } from '@stores/map/selection-store';
import { targetKey, type MapTarget } from '@selection/types';
import { CLUSTER_LIST_MAX } from '@selection/cluster-behavior';
import { fetchClusterMembers, type NearPlace, type NearResult } from '@services/cluster-members';
import WdGeoLink from '@components/map/WdGeoLink.vue';
import { accommodationEntry } from '@selection/entries/accommodation';
import { amenityEntry } from '@selection/entries/amenity';

const props = defineProps<{ target: MapTarget }>();
const selection = useSelectionStore();
const { t, locale } = useI18n();

const p = computed(() => props.target.props as Record<string, unknown>);
const count = computed(() => {
  const n = Number(p.value.count);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
});
const subtree = computed(() => (typeof p.value.subtree === 'string' ? p.value.subtree : ''));
/** Served TILE zoom at click time — the near query's grid snap. */
const tileZoom = computed(() => {
  const n = Number(p.value.tileZoom);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 8;
});
/** Cluster-shaping params forwarded from the overlay's tile URL (same
 *  cluster config the clicked tile was built with). */
const nearParams = computed(() => {
  const raw = p.value.nearParams;
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, string>) : undefined;
});
const clusterColor = computed(() => {
  const raw = p.value.color ?? p.value.parent_color;
  return typeof raw === 'string' && raw ? raw : null;
});

// ── Member fetch (spinner while in flight; retry on failure) ────────
const members = ref<NearPlace[] | null>(null);
/** Endpoint total before `limit` — trusted over the feature count on
 *  mismatch (the near endpoint owns the tile-grid truth). */
const totalCount = ref(0);
const loading = ref(false);
const error = ref(false);
let controller: AbortController | null = null;

function loadMembers(): void {
  if (controller) controller.abort();
  members.value = null;
  error.value = false;
  const anchor = props.target.location;
  if (!anchor || count.value === 0 || count.value >= CLUSTER_LIST_MAX) return;
  controller = new AbortController();
  loading.value = true;
  fetchClusterMembers({
    subtree: subtree.value,
    lat: anchor.lat,
    lon: anchor.lon,
    tileZoom: tileZoom.value,
    count: count.value,
    categoryIdentifier:
      typeof props.target.props.category_identifier === 'string'
        ? props.target.props.category_identifier
        : undefined,
    nearParams: nearParams.value,
    signal: controller.signal,
  })
    .then((result: NearResult) => {
      members.value = result.places;
      totalCount.value = result.count;
    })
    .catch(() => {
      error.value = true;
    })
    .finally(() => {
      loading.value = false;
    });
}

// Retarget / locale switch: refetch (member names localize server-side).
watch([() => props.target.key, locale], loadMembers, { immediate: true });

onScopeDispose(() => controller?.abort());

/** Open a member exactly like an individual symbol click: same source
 *  family and owning entry as the cluster's overlay, seeded with the
 *  member identity the near query provided. */
function openMember(member: NearPlace): void {
  const entry = subtree.value === 'accommodations' ? accommodationEntry : amenityEntry;
  void selection.open(
    {
      key: targetKey({ source: 'geoplace', id: member.slug }),
      source: 'geoplace',
      id: member.slug,
      // Approximate anchor — the member's true position is unknown
      // client-side; the popup re-anchors as soon as tiles carry it.
      location: props.target.location,
      props: {
        slug: member.slug,
        name: member.name,
        color: member.color ?? clusterColor.value,
        category_identifier: member.identifier,
        elevation: member.elevation ?? undefined,
      },
    },
    { via: 'map', entry }
  );
}
</script>

<template>
  <div class="wd-cl-popup">
    <!-- Loading: tiny spinner + count line -->
    <div v-if="loading" class="row items-center no-wrap q-gutter-x-sm">
      <q-spinner-dots data-testid="cluster-members-loading" size="20px" color="primary" />
      <span class="wd-cl-popup__hint">{{ t('place.cluster.count', { n: count }) }}</span>
    </div>

    <!-- Load error: calm retry -->
    <div v-else-if="error" class="row items-center no-wrap q-gutter-x-sm">
      <span class="wd-cl-popup__hint">{{ t('place.cluster.error') }}</span>
      <q-btn dense no-caps size="sm" :label="t('place.cluster.retry')" @click="loadMembers" />
    </div>

    <!-- Member list: color-marked name rows, clickable -->
    <template v-else-if="members && members.length > 0">
      <div class="wd-cl-popup__hint">
        {{ t('place.cluster.count', { n: totalCount || members.length }) }}
      </div>
      <div class="wd-cl-popup__list" role="listbox" :aria-label="t('place.cluster.members')">
        <button
          v-for="member in members"
          :key="member.slug"
          type="button"
          role="option"
          class="wd-cl-popup__item"
          @click="openMember(member)"
        >
          <span
            class="wd-cl-popup__dot"
            :style="{ backgroundColor: member.color ?? clusterColor ?? 'var(--wd-ink-soft)' }"
          />
          <span class="wd-cl-popup__name">{{ member.name }}</span>
          <span v-if="member.elevation" class="wd-cl-popup__elev"> {{ member.elevation }} m </span>
        </button>
      </div>
    </template>

    <!-- Empty result: nothing usable came back — zoom hint row -->
    <div v-else class="wd-cl-popup__hint">{{ t('place.cluster.count', { n: count }) }}</div>

    <!-- Geo link: absolute bottom-right, no flow space (the cluster
         anchor) -->
    <WdGeoLink
      v-if="target.location"
      class="wd-cl-popup__geo"
      :lat="target.location.lat"
      :lon="target.location.lon"
    />
  </div>
</template>

<style lang="scss" scoped>
.wd-cl-popup {
  font-size: 13px;
  line-height: 1.35;
  padding-top: 2px;
  min-width: 0;
}

.wd-cl-popup__hint {
  font-family: 'Barlow Semi Condensed', 'Barlow', sans-serif;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--wd-ink-soft);
}

.wd-cl-popup__list {
  margin-top: 4px;
  max-height: 168px; // ~4 rows — larger sets scroll inside the card
  overflow-y: auto;
  overscroll-behavior: contain;
}

.wd-cl-popup__item {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 4px 6px;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--wd-ink);
  font-family: 'Barlow', sans-serif;
  font-size: 13px;
  text-align: left;

  &:hover,
  &:focus-visible {
    background: var(--wd-wash);
  }
}

.wd-cl-popup__dot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1px solid rgba(var(--wd-ink-rgb, 30 30 30), 0.25);
}

.wd-cl-popup__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wd-cl-popup__elev {
  flex: none;
  font-size: 11px;
  color: var(--wd-ink-soft);
}

// ── Geo link: absolute bottom-right, zero flow space ───────────────
.wd-cl-popup {
  position: relative;
}

.wd-cl-popup__geo {
  position: absolute;
  right: 0;
  bottom: 0;
}
</style>
