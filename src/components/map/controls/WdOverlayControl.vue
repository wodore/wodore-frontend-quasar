<script setup lang="ts">
/**
 * WdOverlayControl — map layer overlay toggle (v4, expand-in-place).
 *
 * The mini strip and the expanded view are THE SAME BOX — when "more" is
 * clicked, the box grows to the LEFT (icons stay at the right edge,
 * labels + info/filter appear to their left).
 *
 * Layer management replicates the old WdOverlaySwitch logic EXACTLY:
 * sources, sprites, layers with zoom-interpolated opacity, render
 * ordering, and re-adding all active overlays on every style load
 * (basemap switches create a new style → layers must be re-added).
 */
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue';
import { useQuasar } from 'quasar';
import { isDefaultGroupSlug, resetGroupToDefault } from '@stores/map/utils/layer-groups';
import { useI18n } from 'vue-i18n';
import { LocalStorage } from 'quasar';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import type { AllPaintProperties } from '@maplibre/maplibre-gl-style-spec';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useBasemapStore } from '@stores/map/basemap-store';
import { useOverlayConfigStore } from '@stores/map/overlay-config-store';
import { useMapMenuStore } from '@stores/map/map-menu-store';
import { OpacitySpecification, OverlaySwitchItem } from '@stores/map/utils/interfaces';
import type { LayerSpecification, PropertyValueSpecification, Map } from 'maplibre-gl';

const { t } = useI18n();
const $q = useQuasar();
const overlayStore = useOverlayStore();
const basemapStore = useBasemapStore();
const configStore = useOverlayConfigStore();
const menuStore = useMapMenuStore();
const mapRef = useMap();

// ── UI state ──────────────────────────────────────────────────────────────
const stripOpen = ref(
  LocalStorage.hasItem('wd_ovl_strip') ? (LocalStorage.getItem('wd_ovl_strip') as boolean) : true
);
watch(
  stripOpen,
  v => {
    LocalStorage.set('wd_ovl_strip', v);
    // flag on <body> — the zoom slider hides while the strip is open
    document.body.classList.toggle('wd-ovl-strip-open', v);
  },
  { immediate: true } // set on mount too — the strip defaults to open
);

/** Box expanded: same box, wider (labels + info/filter visible) */
/** Edit mode: unlocks group CRUD (add/remove layers, rename, etc.) */
const editMode = ref(false);

/** Remove a layer from the active group */
function removeLayerFromGroup(slug: string): void {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  if (!group) return;
  group.layerSlugs = group.layerSlugs.filter(s => s !== slug);
  group.activeLayerSlugs = group.activeLayerSlugs.filter(s => s !== slug);
  overlayStore.syncGroupSettings();
  markEdited();
}

/** Add a layer to the active group */
function addLayerToGroup(slug: string): void {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  if (!group || group.layerSlugs.includes(slug)) return;
  group.layerSlugs.push(slug);
  overlayStore.syncGroupSettings();
  markEdited();
}

// ── Pointer-based drag ordering (edit mode) ────────────────────────────
// HTML5 drag-and-drop NEVER fires on touch devices — the owner uses the
// app on a phone. Pointer events work for touch AND mouse.
const dragSlug = ref<string | null>(null);
const dragOverSlug = ref<string | null>(null);
const dropPos = ref<'above' | 'below'>('below');
const dropOnSep = ref(false);
let pendingDrag: { slug: string; startX: number; startY: number } | null = null;

function onHandlePointerDown(ev: PointerEvent, slug: string): void {
  if (!editMode.value) return;
  pendingDrag = { slug, startX: ev.clientX, startY: ev.clientY };
  // capture: all subsequent moves/ups route to the handle, even off-element
  try {
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
  } catch {
    // capture unsupported — window-level fallback below still tracks via rows
  }
}

function hitTarget(ev: PointerEvent): { row?: string; sep?: boolean } {
  const el = document.elementFromPoint(ev.clientX, ev.clientY);
  const hit = el?.closest('.wd-ovl__row, .wd-ovl__all-sep') as HTMLElement | null;
  if (!hit) return {};
  if (hit.classList.contains('wd-ovl__all-sep')) return { sep: true };
  return { row: hit.dataset.slug ?? undefined };
}

function onHandlePointerMove(ev: PointerEvent): void {
  if (!pendingDrag) return;
  if (!dragSlug.value) {
    // start dragging after a small threshold (avoid accidental taps)
    if (Math.hypot(ev.clientX - pendingDrag.startX, ev.clientY - pendingDrag.startY) < 8) return;
    dragSlug.value = pendingDrag.slug;
  }
  const hit = hitTarget(ev);
  dropOnSep.value = !!hit.sep;
  if (hit.row && hit.row !== dragSlug.value) {
    dragOverSlug.value = hit.row;
    const rowEl = document.querySelector(`.wd-ovl__row[data-slug="${hit.row}"]`);
    if (rowEl) {
      const r = rowEl.getBoundingClientRect();
      dropPos.value = ev.clientY < r.top + r.height / 2 ? 'above' : 'below';
    }
  } else {
    dragOverSlug.value = null;
  }
}

function onHandlePointerUp(ev: PointerEvent): void {
  if (dragSlug.value) {
    const hit = hitTarget(ev);
    if (hit.sep) {
      onDropToAll();
    } else if (hit.row && hit.row !== dragSlug.value) {
      performDrop(dragSlug.value, hit.row);
    }
  }
  pendingDrag = null;
  dragSlug.value = null;
  dragOverSlug.value = null;
  dropOnSep.value = false;
}

/** Reorder within the group, or insert a layer dragged in from All layers */
function performDrop(sourceSlug: string, targetSlug: string): void {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  if (!group) return;
  if (group.layerSlugs.indexOf(targetSlug) < 0) return; // target must be a group row

  const slugs = [...group.layerSlugs];
  const fromIdx = slugs.indexOf(sourceSlug);
  if (fromIdx >= 0) slugs.splice(fromIdx, 1); // reorder: remove first
  const toIdx = slugs.indexOf(targetSlug);
  slugs.splice(dropPos.value === 'above' ? toIdx : toIdx + 1, 0, sourceSlug);
  group.layerSlugs = slugs;
  overlayStore.syncGroupSettings();
  markEdited();
}

function onDropToAll(): void {
  const sourceSlug = dragSlug.value;
  if (!sourceSlug) return;
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  if (group) {
    group.layerSlugs = group.layerSlugs.filter(s => s !== sourceSlug);
    group.activeLayerSlugs = group.activeLayerSlugs.filter(s => s !== sourceSlug);
    overlayStore.syncGroupSettings();
    markEdited();
  }
}

// Track unsaved edits — prompt to save or cancel when leaving edit mode
const hasEdits = ref(false);
const snapshotGroups = ref<string>('');

function takeSnapshot(): void {
  snapshotGroups.value = JSON.stringify(overlayStore.groupSettings.groups);
  hasEdits.value = false;
}

function cancelEdit(): void {
  // Revert to snapshot and exit edit mode
  if (hasEdits.value && snapshotGroups.value) {
    overlayStore.groupSettings.groups = JSON.parse(snapshotGroups.value);
    overlayStore.syncGroupSettings();
  }
  editMode.value = false;
  hasEdits.value = false;
}

function confirmEdit(): void {
  // Keep changes and exit edit mode
  editMode.value = false;
  hasEdits.value = false;
}

function toggleEditMode(): void {
  if (!editMode.value) {
    updateEditCap();
    editMode.value = true;
    takeSnapshot();
    hasEdits.value = false;
    return;
  }
  if (hasEdits.value) {
    // 3-way: Save / Discard / dismiss (esc or backdrop = keep editing)
    let action: 'save' | 'discard' | null = null;
    $q.dialog({
      title: t('overlays.edit_unsaved_title'),
      message: t('overlays.edit_unsaved_message'),
      ok: { label: t('overlays.edit_save'), unelevated: true, color: 'positive' },
      cancel: { label: t('overlays.edit_discard'), flat: true },
    })
      .onOk(() => { action = 'save'; })
      .onCancel(() => { action = 'discard'; })
      .onDismiss(() => {
        if (action === 'save') {
          editMode.value = false;
          hasEdits.value = false;
        } else if (action === 'discard') {
          if (snapshotGroups.value) {
            overlayStore.groupSettings.groups = JSON.parse(snapshotGroups.value);
            overlayStore.syncGroupSettings();
          }
          editMode.value = false;
          hasEdits.value = false;
        }
        // action === null: dismissed without choice → keep editing
      });
    return;
  }
  editMode.value = false;
}

function markEdited(): void {
  if (editMode.value) hasEdits.value = JSON.stringify(overlayStore.groupSettings.groups) !== snapshotGroups.value;
}

/** Add a new group */
function addNewGroup(): void {
  $q.dialog({
    title: t('overlays.group_add'),
    prompt: { model: '', type: 'text', outlined: true, label: t('overlays.group_name') },
    cancel: true,
    persistent: false,
  }).onOk((name: string | number | null) => {
    const n = String(name ?? '').trim();
    if (!n) return;
    addGroupWithName(n);
  });
}

function addGroupWithName(name: string): void {
  const group = {
    id: typeof window !== 'undefined' && window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    icon: 'hiking',
    layerSlugs: [],
    activeLayerSlugs: [],
    hidden: false,
    removed: false,
    locked: false,
    sortOrder: overlayStore.groupSettings.groups.length,
  };
  overlayStore.groupSettings.groups.push(group);
  overlayStore.groupSettings.activeGroupId = group.id;
  overlayStore.syncGroupSettings();
  markEdited();
  markEdited();
}

/** Rename the active group (prompt) */
function startRename(): void {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  if (!group) return;
  $q.dialog({
    title: t('overlays.group_rename'),
    prompt: { model: overlayStore.activeGroupName(t), type: 'text', outlined: true, label: t('overlays.group_name') },
    cancel: true,
    persistent: false,
  }).onOk((name: string | number | null) => {
    const n = String(name ?? '').trim();
    if (n) {
      group.name = n;
      overlayStore.syncGroupSettings();
      markEdited();
    }
  });
}

/** Is the active group one of the predefined (resettable) groups? */
const isDefaultGroup = computed(() => {
  const g = overlayStore.groupSettings.groups.find(
    x => x.id === overlayStore.groupSettings.activeGroupId
  );
  return g ? isDefaultGroupSlug(g.slug) : false;
});

/** Reset the active group to its predefined definition */
function resetGroup(): void {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  if (!group) return;
  if (resetGroupToDefault(group)) {
    overlayStore.syncGroupSettings();
    markEdited();
  }
}

/** Hide the active group (only in edit mode) */
function hideGroup(): void {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  if (!group) return;
  group.hidden = true;
  overlayStore.syncGroupSettings();
  markEdited();
  // Cycle to the next visible group
  overlayStore.cycleGroup();
}

/** Delete the active group (confirm) */
function confirmDeleteGroup(): void {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  if (!group) return;
  $q
    .dialog({
      title: t('overlays.group_delete'),
      message: t('overlays.group_delete_confirm', { name: overlayStore.activeGroupName(t) }),
      cancel: true,
      ok: { label: t('overlays.group_delete'), unelevated: true, color: 'negative' },
    })
    .onOk(() => deleteActiveGroup());
}

function deleteActiveGroup(): void {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  if (!group) return;
  group.removed = true;
  markEdited();
  // Removed group's layers return to ungrouped (they stay in the flat
  // All-layers list automatically once no group references them).
  overlayStore.syncGroupSettings();
  overlayStore.cycleGroup();
}

/** Check if a layer is in the active group */
function isInActiveGroup(slug: string): boolean {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  return group?.layerSlugs.includes(slug) ?? false;
}
const expanded = ref(false);

/** Scroll fades: hide when the respective edge is reached */
const scrollAtTop = ref(true);
const scrollAtBottom = ref(false);

function onRowsScroll(e: Event): void {
  const el = e.target as HTMLElement;
  scrollAtTop.value = el.scrollTop <= 2;
  scrollAtBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
  // custom overlay thumb (native scrollbar removed — it squeezed the
  // 48px mini box and cut the chips on desktop)
  const ratio = el.clientHeight / el.scrollHeight;
  thumbH.value = Math.max(24, Math.round(ratio * el.clientHeight));
  const maxTop = el.clientHeight - thumbH.value;
  thumbTop.value = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * maxTop);
}

const thumbTop = ref(0);
const thumbH = ref(0);

/** Thumb position relative to the BOX (rows may sit below the toolbar) */
const thumbAbsTop = computed(() => {
  const rows = document.querySelector('.wd-ovl__rows') as HTMLElement | null;
  const offset = rows ? rows.offsetTop : 0;
  return offset + thumbTop.value;
});

/** Initial thumb measurement (before any scroll) */
function measureThumb(): void {
  const rows = document.querySelector('.wd-ovl__rows') as HTMLElement | null;
  if (!rows || rows.scrollHeight <= rows.clientHeight) {
    thumbH.value = 0;
    return;
  }
  const ratio = rows.clientHeight / rows.scrollHeight;
  thumbH.value = Math.max(24, Math.round(ratio * rows.clientHeight));
  const maxTop = rows.clientHeight - thumbH.value;
  thumbTop.value = Math.round((rows.scrollTop / (rows.scrollHeight - rows.clientHeight)) * maxTop);
  scrollAtTop.value = rows.scrollTop <= 2;
  scrollAtBottom.value = rows.scrollTop + rows.clientHeight >= rows.scrollHeight - 2;
}

onMounted(() => {
  // measure once the list rendered; re-measure when it resizes
  setTimeout(measureThumb, 400);
  rowsResizeObserve();
});

function rowsResizeObserve(): void {
  const rows = document.querySelector('.wd-ovl__rows') as HTMLElement | null;
  if (!rows) return;
  const RO = (window as unknown as { ResizeObserver?: new (cb: () => void) => { observe: (el: HTMLElement) => void } }).ResizeObserver;
  if (!RO) return;
  new RO(() => measureThumb()).observe(rows);
}

// ── 2. Pan-to-scroll (mouse): drag scrolls, small moves still click ──
const panned = ref(false);
let panStartY = 0;
let panStartScroll = 0;
let panActive = false;

function onRowsPointerDown(e: MouseEvent): void {
  // mouse only — touch uses native scroll (touch-action: pan-y)
  if ((e as unknown as { pointerType?: string }).pointerType === 'touch') return;
  panActive = true;
  panned.value = false;
  panStartY = e.clientY;
  panStartScroll = (e.currentTarget as HTMLElement).scrollTop;
}

function onRowsPointerMove(e: MouseEvent): void {
  if (!panActive) return;
  const dy = e.clientY - panStartY;
  if (!panned.value && Math.abs(dy) > 4) panned.value = true; // it's a pan
  if (panned.value) {
    (e.currentTarget as HTMLElement).scrollTop = panStartScroll - dy;
  }
}

function onRowsPointerUp(): void {
  panActive = false;
  // keep panned=true through the click that follows the pointerup,
  // then reset so stray clicks (without a preceding pan) pass
  window.setTimeout(() => {
    panned.value = false;
  }, 50);
}

/** Rows click guard: a pan must not toggle the layer */
function onRowClick(item: OverlaySwitchItem): void {
  if (panned.value) return;
  toggleLayer(item);
}

/** Swipe left = expand, swipe right = collapse (on rows and toggle) */
let swipeStartX: number | null = null;
function onSwipeStart(e: Event): void {
  swipeStartX = (e as unknown as { touches: Array<{ clientX: number }> }).touches[0]?.clientX ?? null;
}
function onSwipeEnd(e: Event): void {
  if (swipeStartX === null) return;
  const endX = (e as unknown as { changedTouches: Array<{ clientX: number }> }).changedTouches[0]?.clientX ?? swipeStartX;
  const delta = endX - swipeStartX;
  swipeStartX = null;
  if (Math.abs(delta) < 30) return;
  if (delta < 0) expanded.value = true;
  else if (delta > 0) expanded.value = false;
}

/** Click outside the control collapses the expanded box */
function onDocClick(ev: Event): void {
  const target = ev.target as HTMLElement;
  if (!target.closest('.wd-ovl')) {
    // In edit mode, never auto-close — the user must explicitly exit
    if (editMode.value) return;
    expanded.value = false;
  }
}

watch(expanded, v => {
  if (v) document.addEventListener('click', onDocClick, { capture: true });
  else document.removeEventListener('click', onDocClick, { capture: true });
});

onBeforeUnmount(() => document.removeEventListener('click', onDocClick, { capture: true }));

// ── Icons ─────────────────────────────────────────────────────────────────
const iconOpen = new URL(
  '/src/assets/wodore-design/icons/export/overlay-switch.svg',
  import.meta.url
).href;
const iconClose = new URL(
  '/src/assets/wodore-design/icons/export/overlay-switch-close.svg',
  import.meta.url
).href;

function layerIcon(name: string): string {
  return (
    'img:' + new URL(`/src/assets/wodore-design/overlays/exports/${name}.svg`, import.meta.url).href
  );
}

/** Layers to show in the mini strip (active group only) */
// Edit-mode height cap: stay 1 button-height below the top-right map
// controls (desktop: geolocate/nav cluster y≈58-274) and below the topbar.
// Measured live — CSS alone can't know the control cluster's height.
const editMaxH = ref<number | null>(null);
function updateEditCap(): void {
  const boxEl = document.querySelector('.wd-ovl__box');
  if (!boxEl) return;
  const boxBottom = boxEl.getBoundingClientRect().bottom;
  let limit = 0;
  const topbar = document.querySelector('.wd-topbar');
  if (topbar) limit = Math.max(limit, topbar.getBoundingClientRect().bottom);
  const ctrls = document.querySelector('.maplibregl-ctrl-top-right');
  if (ctrls) limit = Math.max(limit, ctrls.getBoundingClientRect().bottom);
  editMaxH.value = Math.max(220, Math.round(boxBottom - limit - 48));
}
window.addEventListener('resize', () => { if (editMode.value) updateEditCap(); });

// Reset rows scroll when entering expanded (group layers must show first)
const rowsEl = ref<HTMLElement | null>(null);
watch([expanded, editMode], ([exp, edit], [prevExp, prevEdit]) => {
  if ((exp && !prevExp) || (!edit && prevEdit)) {
    nextTick(() => rowsEl.value?.scrollTo({ top: 0 }));
  }
});

const miniLayers = computed(() => {
  return overlayStore.activeGroupLayers();
});

/** Layers for the expanded view "All layers" section.
 *  Edit mode shows ALL layers — hidden groups stay editable (owner rule). */
const expandedOtherLayers = computed(() => overlayStore.otherLayers());

/** Active layers from OTHER groups — shown in the mini strip below group layers */
const promotedLayers = computed(() => {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  const groupSlugs = new Set(group?.layerSlugs ?? []);
  return (overlayStore.overlays as unknown as Array<{ name: string; show?: boolean; active?: boolean }>)
    .filter(o => o.show === true && o.active === true && !groupSlugs.has(o.name))
    .map(o => overlayStore.overlays.find(ov => ov.name === o.name))
    .filter((o): o is NonNullable<typeof o> => !!o);
});

/** Handle group selector tap */
function onGroupSelectorTap(): void {
  overlayStore.cycleGroup(editMode.value);
  // Re-apply visibility for ALL layers (the group switch changed active states)
  for (const item of overlayStore.overlays) {
    setOverlayVisibility(item as OverlaySwitchItem);
  }
}

// ── Layer management (ported 1:1 from the old WdOverlaySwitch) ────────────

function setOverlayVisibility(overlay: OverlaySwitchItem): boolean {
  if (mapRef.map === undefined) return false;
  for (const layer of overlay.style.layers) {
    if (mapRef.map.getLayer(layer.id)) {
      mapRef.map.setLayoutProperty(layer.id, 'visibility', overlay.active ? 'visible' : 'none');
    }
  }
  return true;
}

interface AddOverlayLayerArgs {
  layer: LayerSpecification;
  onLayer?: OverlaySwitchItem['onLayer'];
  defaultOpacity?: OpacitySpecification;
  beforeId?: string | undefined;
}

function addOverlayLayer({ layer, onLayer, defaultOpacity, beforeId }: AddOverlayLayerArgs): void {
  const basemap = basemapStore.getBasemap();
  const basemapOpacity =
    basemap && onLayer !== undefined ? basemap.layers[onLayer]?.opacity : undefined;
  let autoOpacity = false;
  if (defaultOpacity === undefined || defaultOpacity === true) {
    autoOpacity = true;
    defaultOpacity = ['interpolate', ['linear'], ['zoom'], 8, 0.9, 14, 0.6, 22, 0.5];
  }
  if (mapRef.map?.getLayer(layer.id) === undefined) {
    let opacity: PropertyValueSpecification<number> | undefined =
      defaultOpacity !== false ? defaultOpacity : undefined;
    let _beforeId = beforeId;
    if (_beforeId === undefined && onLayer) {
      _beforeId = basemap?.layers[onLayer]?.before;
    }
    if (basemapOpacity !== undefined) {
      opacity = basemapOpacity;
    }
    const _source = 'source' in layer ? layer.source : undefined;
    if ((_source && mapRef.map?.getSource(_source)) || _source === undefined) {
      mapRef.map?.addLayer(layer, _beforeId);
      const opacityPropertiesByType: Record<string, string[]> = {
        background: ['background-opacity'],
        fill: ['fill-opacity'],
        'fill-extrusion': ['fill-extrusion-opacity'],
        line: ['line-opacity'],
        circle: ['circle-opacity'],
        raster: ['raster-opacity'],
        heatmap: ['heatmap-opacity'],
        hillshade: ['hillshade-opacity'],
        symbol: ['icon-opacity', 'text-opacity'],
      };
      const opacityProperties = opacityPropertiesByType[layer.type] ?? [];
      if (layer.paint !== undefined && opacityProperties.some(p => p in layer.paint!)) {
        defaultOpacity = false;
      }
      if (defaultOpacity === false) {
        opacity = undefined;
      } else if (autoOpacity === false) {
        opacity = defaultOpacity;
      }
      if (opacity !== undefined && opacityProperties.length > 0) {
        for (const property of opacityProperties) {
          mapRef.map?.setPaintProperty(layer.id, property as keyof AllPaintProperties, opacity);
        }
      }
    } else {
      console.error(
        `[addOverlayLayer] Source '${_source}' not added, tried to add layer '${layer.id}'.`
      );
    }
  }
}

const addedOverlays = new Set<string>();

function getOverlaysInRenderOrder(): Array<OverlaySwitchItem> {
  // Break type inference chain to avoid "excessively deep" TypeScript error
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const allOverlays = (overlayStore as any).overlays as Array<OverlaySwitchItem>;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const backOverlays = allOverlays.slice().filter(v => v.onLayer === 'background');
  const frontOverlays = allOverlays.slice().filter(v => v.onLayer === 'ways');
  return frontOverlays.concat(backOverlays).reverse();
}

function findBeforeLayerId(
  overlay: OverlaySwitchItem,
  overlaysOrder: Array<OverlaySwitchItem>
): string | undefined {
  const overlayIndex = overlaysOrder.findIndex(item => item.name === overlay.name);
  if (overlayIndex === -1) return undefined;
  for (let i = overlayIndex + 1; i < overlaysOrder.length; i += 1) {
    const candidate = overlaysOrder[i];
    if (candidate.onLayer !== overlay.onLayer) continue;
    for (const layer of candidate.style.layers) {
      if (mapRef.map?.getLayer(layer.id)) return layer.id;
    }
  }
  return undefined;
}

function addOverlay(overlay: OverlaySwitchItem, overlaysOrder: Array<OverlaySwitchItem>): void {
  if (addedOverlays.has(overlay.name)) return;
  for (const label in overlay.style.sources) {
    if (mapRef.map?.getSource(label) === undefined) {
      mapRef.map?.addSource(label, overlay.style.sources[label]);
    }
  }
  // Add sprites if defined (loads e.g. wd:detailed/* hut symbols)
  const spriteData = overlay.style.sprite;
  if (spriteData) {
    const existingSprites = mapRef.map?.getSprite() || [];
    if (Array.isArray(spriteData)) {
      for (const sprite of spriteData) {
        const alreadyAdded = existingSprites.some(e => e.id === sprite.id);
        if (!alreadyAdded) mapRef.map?.addSprite(sprite.id, sprite.url);
      }
    } else if (typeof spriteData === 'object') {
      for (const [spriteId, spriteUrl] of Object.entries(spriteData)) {
        const alreadyAdded = existingSprites.some(e => e.id === spriteId);
        if (!alreadyAdded) mapRef.map?.addSprite(spriteId, spriteUrl as string);
      }
    }
  }
  const beforeId = findBeforeLayerId(overlay, overlaysOrder);
  for (const layer of overlay.style.layers) {
    const layerWithVisibility = {
      ...layer,
      layout: { ...(layer.layout || {}), visibility: overlay.active ? 'visible' : 'none' },
    };
    addOverlayLayer({
      layer: layerWithVisibility as LayerSpecification,
      defaultOpacity: overlay.opacity as OpacitySpecification,
      onLayer: overlay.onLayer,
      beforeId,
    });
  }
  setOverlayVisibility(overlay);
  addedOverlays.add(overlay.name);
}

function addOverlays(): void {
  addedOverlays.clear();
  const overlaysOrder = getOverlaysInRenderOrder();
  for (const overlay of overlaysOrder) {
    if (overlay.active) addOverlay(overlay, overlaysOrder);
  }
  configStore.reapplyAllFilters();
}

function toggleLayer(item: OverlaySwitchItem): void {
  overlayStore.toggleOverlay(item);
  if (item.active) {
    addOverlay(item, getOverlaysInRenderOrder());
  }
  setOverlayVisibility(item);
}

// Map lifecycle: re-add overlays on EVERY style load (basemap switches
// create a new style → sources/layers are wiped). The old switch used
// map.on('load') the same way.
let mapLoadBound = false;
function bindMap(map: Map): void {
  if (mapLoadBound) return;
  mapLoadBound = true;
  if (map.isStyleLoaded()) addOverlays();
  map.on('load', addOverlays);
}

watch(
  () => mapRef.map,
  map => {
    if (map) bindMap(map);
  },
  { immediate: true }
);

// ── Actions ───────────────────────────────────────────────────────────────

function openConfig(overlayName: string, tab?: string): void {
  const overlay = overlayStore.overlays.find(o => o.name === overlayName);
  menuStore.openOverlayConfig(overlayName, tab);
  menuStore.menuData.title = overlay?.label ?? overlayName;
}

function hasInfo(overlayName: string): boolean {
  const overlay = overlayStore.overlays.find(o => o.name === overlayName);
  return !!(overlay?.config?.legend?.sections?.length);
}

function hasFilterConfig(overlayName: string): boolean {
  const overlay = overlayStore.overlays.find(o => o.name === overlayName);
  return !!(overlay?.config?.filters?.length);
}

function hasActiveFilters(overlayName: string): boolean {
  const overlay = overlayStore.overlays.find(o => o.name === overlayName);
  const config = overlay?.config;
  if (!config?.filters?.length) return false;
  return config.filters.some(f => {
    const value = configStore.getFilterValue(overlayName, f.id);
    if (Array.isArray(value)) {
      return value.length > 0 && value.length < (f.options?.length ?? 0);
    }
    return value !== f.defaultValue;
  });
}

onMounted(() => {
  // Desktop: ensure wheel scrolling works over the rows container
  // (the map canvas would otherwise capture the wheel event)
  document.querySelectorAll('.wd-ovl__rows').forEach(() => {
    /* handled via CSS touch-action + overflow; nothing needed here */
  });
});

onBeforeUnmount(() => {
  swipeStartX = null;
});
</script>

<template>
  <div class="wd-ovl">
    <!-- ── THE BOX: mini strip (collapsed) or expanded (same box, wider) ── -->
    <Transition name="wd-ovl-strip">
      <div
        v-if="stripOpen"
        class="wd-ovl__box"
        :class="{ 'wd-ovl__box--expanded': expanded, 'wd-ovl__box--edit': editMode }"
        :style="{
          '--mini-rows': miniLayers.length,
          ...(editMode && editMaxH ? { maxHeight: editMaxH + 'px' } : {}),
        }"
      >
        <!-- Top toolbar: EXTENDED only. The box grows UP by this height
             (max-height compensates) so the icon rows NEVER move. -->
        <div v-if="expanded" class="wd-ovl__toolbar" @wheel.prevent>
          <span class="wd-ovl__toolbar-icon">
            <q-icon :name="layerIcon(overlayStore.activeGroupIcon())" size="16px" />
          </span>
          <span class="wd-ovl__toolbar-title">{{ overlayStore.activeGroupName(t) }}</span>
          <div class="wd-ovl__toolbar-actions">
            <button
              class="wd-ovl__toolbar-btn"
              :class="{ 'wd-ovl__toolbar-btn--active': editMode }"
              :aria-label="editMode ? t('overlays.edit_done') : t('overlays.edit_groups')"
              @click.stop="toggleEditMode"
            >
              <svg v-if="!editMode" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Edit actions: icon-only, one compact row (edit mode only) -->
        <div v-if="editMode" class="wd-ovl__edit-bar" @wheel.prevent>
          <button class="wd-ovl__edit-btn" :aria-label="t('overlays.group_rename')" :title="t('overlays.group_rename')"
            @click.stop="startRename">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
            </svg>
          </button>
          <button class="wd-ovl__edit-btn" :aria-label="t('overlays.group_hide')" :title="t('overlays.group_hide')"
            @click.stop="hideGroup">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button class="wd-ovl__edit-btn wd-ovl__edit-btn--danger" :aria-label="t('overlays.group_delete')" :title="t('overlays.group_delete')"
            @click.stop="confirmDeleteGroup">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
            </svg>
          </button>
          <button v-if="isDefaultGroup" class="wd-ovl__edit-btn" :aria-label="t('overlays.group_reset')" :title="t('overlays.group_reset')"
            @click.stop="resetGroup">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 2.6-6.4" />
              <path d="M3 4v4h4" />
              <path d="M12 8v4l3 2" />
            </svg>
          </button>
          <span class="wd-ovl__edit-sep" />
          <button class="wd-ovl__edit-btn wd-ovl__edit-btn--add" :aria-label="t('overlays.group_add')" :title="t('overlays.group_add')"
            @click.stop="addNewGroup">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        <!-- Rows: icon always at the right, label+actions appear when expanded -->
        <!-- Fades are INSIDE the rows container (they belong to the scroll area,
             not the box — they must track the rows' visible edges) -->
        <div
          :key="overlayStore.groupSettings.activeGroupId ?? 'none'"
          ref="rowsEl"
          class="wd-ovl__rows"
          role="group"
          :aria-label="t('overlay_style')"
          @scroll.passive="onRowsScroll"
          @pointerdown="onRowsPointerDown"
          @pointermove="onRowsPointerMove"
          @pointerup="onRowsPointerUp"
          @pointerleave="onRowsPointerUp"
        >
          <!-- Top fade: sticky at the scroll viewport's top edge -->
          <div class="wd-ovl__fade wd-ovl__fade--top" :class="{ 'wd-ovl__fade--hidden': scrollAtTop }" />
          <div v-for="item in miniLayers" :key="item.name" v-show="item.show" class="wd-ovl__row" :class="{
            'wd-ovl__row--active': item.active,
            'wd-ovl__row--passive': !item.active,
            'wd-ovl__row--dragging': dragSlug === item.name,
            'wd-ovl__row--drop-above': dragOverSlug === item.name && dragSlug !== item.name && dropPos === 'above',
            'wd-ovl__row--drop-below': dragOverSlug === item.name && dragSlug !== item.name && dropPos === 'below',
          }"
            :data-slug="item.name"
            @click="onRowClick(<OverlaySwitchItem>(item as unknown))">
            <!-- Label + actions (LEFT of icon, only when expanded) -->
            <div v-if="expanded" class="wd-ovl__row-info">
              <span v-if="editMode" class="wd-ovl__drag-handle" title="Drag to reorder"
                @pointerdown.stop="onHandlePointerDown($event, item.name)"
                @pointermove="onHandlePointerMove"
                @pointerup="onHandlePointerUp"
                @pointercancel="onHandlePointerUp">
                <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                  <circle cx="2" cy="3" r="1.2" /><circle cx="6" cy="3" r="1.2" />
                  <circle cx="2" cy="8" r="1.2" /><circle cx="6" cy="8" r="1.2" />
                  <circle cx="2" cy="13" r="1.2" /><circle cx="6" cy="13" r="1.2" />
                </svg>
              </span>
              <button v-if="hasInfo(item.name)" class="wd-ovl__row-action wd-ovl__row-action--info"
                :aria-label="`${item.label} info`" title="Info" @click.stop="openConfig(item.name, 'legend')">
                <q-icon name="wd-info" size="xs" />
              </button>
              <span class="wd-ovl__row-name">{{ item.label }}</span>
              <button v-if="hasFilterConfig(item.name)" class="wd-ovl__row-action"
                :class="{ 'wd-ovl__row-action--filtered': hasActiveFilters(item.name) }"
                :aria-label="`${item.label} filter`" title="Filter" @click.stop="openConfig(item.name, 'filter')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />
                </svg>
              </button>
              <button
                v-if="editMode"
                class="wd-ovl__row-action wd-ovl__row-action--remove"
                :aria-label="`${item.label} remove from group`" title="Remove from group"
                @click.stop="removeLayerFromGroup(item.name)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M5 12h14" />
                </svg>
              </button>
            </div>

            <!-- Icon button (ALWAYS at the right edge of the box) -->
            <span class="wd-ovl__icon" :class="{
              'wd-ovl__icon--active': item.active,
              'wd-ovl__icon--inactive': !item.active,
            }" :aria-label="item.label" role="button" :aria-pressed="item.active" @touchstart.passive="onSwipeStart"
              @touchend.passive="onSwipeEnd">
              <q-icon :name="layerIcon(item.icon)" size="20px" />
              <span v-if="hasActiveFilters(item.name)" class="wd-ovl__chip-filter"
                :aria-label="`${item.label}: filter active`">
                <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />
                </svg>
              </span>
            </span>
          </div>
          <!-- All layers section (inside the scrollable rows) -->
        <!-- All layers section (expanded only, below the group layers) -->
        <template v-if="expanded">
          <div
            class="wd-ovl__all-sep"
            :class="{ 'wd-ovl__all-sep--drop': dropOnSep }"
          >
            <span class="wd-ovl__all-label">{{ t('overlays.all_layers') }}</span>
          </div>
          <div
            v-for="item in expandedOtherLayers"
            :key="item.name"
            v-show="item.show"
            class="wd-ovl__row wd-ovl__row--other"
            :class="{
              'wd-ovl__row--active': item.active,
              'wd-ovl__row--passive': !item.active,
              'wd-ovl__row--dragging': dragSlug === item.name,
            }"
            :data-slug="item.name"
            @click="toggleLayer(<OverlaySwitchItem>(item as unknown))"
          >
            <div class="wd-ovl__row-info">
              <span v-if="editMode" class="wd-ovl__drag-handle" title="Drag into the group"
                @pointerdown.stop="onHandlePointerDown($event, item.name)"
                @pointermove="onHandlePointerMove"
                @pointerup="onHandlePointerUp"
                @pointercancel="onHandlePointerUp">
                <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                  <circle cx="2" cy="3" r="1.2" /><circle cx="6" cy="3" r="1.2" />
                  <circle cx="2" cy="8" r="1.2" /><circle cx="6" cy="8" r="1.2" />
                  <circle cx="2" cy="13" r="1.2" /><circle cx="6" cy="13" r="1.2" />
                </svg>
              </span>
              <button
                v-if="hasInfo(item.name)"
                class="wd-ovl__row-action wd-ovl__row-action--info"
                :aria-label="`${item.label} info`"
                @click.stop="openConfig(item.name, 'legend')"
              >
                <q-icon name="wd-info" size="xs" />
              </button>
              <span class="wd-ovl__row-name">{{ item.label }}</span>
              <button
                v-if="hasFilterConfig(item.name)"
                class="wd-ovl__row-action"
                :aria-label="`${item.label} filter`"
                @click.stop="openConfig(item.name, 'filter')"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />
                </svg>
              </button>
              <button
                v-if="editMode && !isInActiveGroup(item.name)"
                class="wd-ovl__row-action wd-ovl__row-action--add"
                :aria-label="`${item.label} add to group`"
                @click.stop="addLayerToGroup(item.name)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
            <span
              class="wd-ovl__icon"
              :class="{
                'wd-ovl__icon--active': item.active,
                'wd-ovl__icon--inactive': !item.active,
              }"
              :aria-label="item.label"
              role="button"
              :aria-pressed="item.active"
              @touchstart.passive="onSwipeStart"
              @touchend.passive="onSwipeEnd"
            >
              <q-icon :name="layerIcon(item.icon)" size="20px" />
            </span>
          </div>
        </template>
          <!-- Bottom fade: LAST child so sticky anchors at the scroll bottom -->
          <div class="wd-ovl__fade wd-ovl__fade--bottom" :class="{ 'wd-ovl__fade--hidden': scrollAtBottom }" />
        </div>

        <!-- Promoted layers: active layers from OTHER groups. Rendered in
             BOTH mini and expanded (below the scroll area, above the group
             selector) so the box height and icon positions never change
             when expanding. Hidden in edit mode (All-layers covers them). -->
        <template v-if="!editMode && promotedLayers.length > 0">
          <div class="wd-ovl__promoted-sep" />
          <div v-for="item in promotedLayers" :key="`p-${item.name}`" class="wd-ovl__row"
            :class="{ 'wd-ovl__row--active': item.active }"
            @click="onRowClick(<OverlaySwitchItem>(item as unknown))">
            <div v-if="expanded" class="wd-ovl__row-info">
              <span class="wd-ovl__row-name">{{ item.label }}</span>
            </div>
            <span class="wd-ovl__icon wd-ovl__icon--active" :aria-label="item.label">
              <q-icon :name="layerIcon(item.icon)" size="20px" />
            </span>
          </div>
        </template>

        <!-- Group selector: spans the box width, distinct from layer buttons.
             In edit mode it cycles ALL groups (hidden included). -->
        <button
          class="wd-ovl__group-btn"
          :aria-label="overlayStore.activeGroupName(t)"
          :title="overlayStore.activeGroupName(t)"
          @click.stop="onGroupSelectorTap"
          @wheel.prevent
        >
          <q-icon :name="layerIcon(overlayStore.activeGroupIcon())" size="20px" />
          <svg class="wd-ovl__group-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>


        <!-- Scroll thumb at BOX level (the rows scroll-clip ate it inside);
             rides exactly on the box's right border. Always visible while
             the list overflows — 2px on desktop (media query below). -->
        <div
          v-if="thumbH > 0"
          class="wd-ovl__scrollthumb"
          :class="{ 'wd-ovl__scrollthumb--end': scrollAtBottom }"
          :style="{ top: thumbAbsTop + 'px', height: thumbH + 'px' }"
        />

        <!-- More button: toggles the box between mini and expanded -->
        <!-- In edit mode: cancel (X) and confirm (✓) replace the more button -->
        <div v-if="editMode" class="wd-ovl__more-group" @wheel.prevent>
          <button class="wd-ovl__more wd-ovl__more--cancel" :aria-label="t('overlays.edit_cancel')"
            @click.stop="cancelEdit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <button class="wd-ovl__more wd-ovl__more--confirm" :aria-label="t('overlays.edit_done')"
            @click.stop="confirmEdit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
        <button v-else class="wd-ovl__more" :aria-label="expanded ? t('close') : t('overlay_style')" :aria-expanded="expanded"
          @click.stop="expanded = !expanded">
          <svg v-if="!expanded" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </Transition>

    <!-- ── Main toggle (48px, colored SVG icon, 360° rotation) ───────── -->
    <button class="wd-ovl__toggle" :aria-label="t('overlay_style')" :aria-expanded="stripOpen"
      @click="stripOpen = !stripOpen">
      <img v-show="!stripOpen" :src="iconOpen" alt="" class="wd-ovl__toggle-icon wd-ovl__toggle-icon--closed-icon"
        :class="{ 'wd-ovl__toggle-icon--hidden': stripOpen }" />
      <img v-show="stripOpen" :src="iconClose" alt="" class="wd-ovl__toggle-icon"
        :class="{ 'wd-ovl__toggle-icon--open': stripOpen }" />
    </button>
  </div>
</template>

<style lang="scss" scoped>
@use '../../../css/map-controls/chip' as chip;
// ══════════════════════════════════════════════════════════════════════
// WdOverlayControl v4 — Alpine Instrument polish
//
// - Gold = beam only (2px inset ring on active icons)
// - Passive icons: bordered chip (like the old round toggles)
// - Radius: 8px box / 4px controls (canonical ramp)
// - Motion: cubic-bezier(0.2, 0, 0, 1), 220–350ms
// ══════════════════════════════════════════════════════════════════════

$ease: cubic-bezier(0.2, 0, 0, 1);

// ── Container ────────────────────────────────────────────────────────────
.wd-ovl {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  pointer-events: none; // map gestures pass through empty space
  -webkit-tap-highlight-color: transparent;

  *:focus {
    outline: none;
  }
}

// ── Toggle button (48px, colored icon) ──────────────────────────────────
.wd-ovl__toggle {
  @include chip.control; // 48px recipe — single source in _chip.scss
  padding: 8px;
  pointer-events: auto;

  .wd-ovl__toggle-icon {
    position: absolute;
    inset: 8px;
    width: calc(100% - 16px);
    height: calc(100% - 16px);
    object-fit: contain;
    transition:
      opacity 0.2s $ease,
      transform 0.28s $ease;
    will-change: transform, opacity;
  }

  // Morph: closed icon shrinks out, open icon grows in (no rotation)
  .wd-ovl__toggle-icon--open {
    opacity: 1;
    transform: scale(1);
  }

  .wd-ovl__toggle-icon--hidden {
    opacity: 0;
    transform: scale(0.6);
  }

  .wd-ovl__toggle-icon--closed-icon {
    opacity: 0.72; // passive dimmer — subtle, never ghosted
    transform: scale(1);
    transition:
      opacity 0.2s $ease 0.06s,
      transform 0.28s $ease 0.06s;
  }

  &:hover .wd-ovl__toggle-icon--closed-icon {
    opacity: 0.9;
  }
}

// ── THE BOX ──────────────────────────────────────────────────────────────
.wd-ovl {
  user-select: none;
  -webkit-user-select: none;
}

.wd-ovl__box {
  display: flex;
  flex-direction: column;
  width: 48px;
  max-height: calc(100dvh - 220px);
  transition: width 0.25s cubic-bezier(0.2, 0, 0, 1);
  border-radius: 8px;
  border: 1px solid var(--wd-ctl-border);
  background: var(--wd-ctl-bg);
  box-shadow: var(--wd-ctl-shadow);
  overflow: visible; // toolbar floats above (absolute) — must not clip
  position: relative; // anchor for the absolute scroll fades
  transition: max-height 0.25s cubic-bezier(0.2, 0, 0, 1); // animate group changes
  pointer-events: none; // map gestures pass through — rows opt back in
  transition:
    width 0.28s $ease,
    border-color 0.15s $ease;
  contain: layout;

  &--expanded {
    width: 216px;
    // SAME height as mini — the rows cap at the mini content height
    // (--mini-rows CSS var, set on the box element) and scroll.

    animation: wd-ovl-pop 0.28s $ease;
  }
}

// ── Top toolbar (space reserved in BOTH states — icons never move) ───────
.wd-ovl__toolbar {
  pointer-events: auto; // wheel/interaction over the header must not reach the map
  // ABSOLUTE above the box — the rows start at the same Y as in mini.
  // The box grows UP (bottom-anchored sticky) — the toolbar is the growth.
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  height: 42px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  background: var(--wd-ctl-bg);
  border: 1px solid var(--wd-ctl-border);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
}

.wd-ovl__toolbar-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: var(--wd-ctl-bg);
  border: 1px solid var(--wd-ctl-border);
}

.wd-ovl__toolbar-title {
  flex: 1;
  min-width: 0;
  font-family: 'Barlow Semi Condensed', 'Barlow', sans-serif;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--wd-ctl-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 8px;

  // Small gold tick before the text — same pattern as wd-section-title
  &::before {
    content: '';
    width: 3px;
    height: 14px;
    border-radius: 1px;
    flex: none;
    background: $wd-gold;
  }
}

.wd-ovl__toolbar-actions {
  display: flex;
  gap: 2px;
  flex: none;
  pointer-events: auto;
}

.wd-ovl__toolbar-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 36px;
  border: 1px solid var(--wd-ctl-border);
  border-radius: 4px;
  background: var(--wd-ctl-bg);
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  pointer-events: auto;
  flex: none;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;

  &:hover {
    background: var(--wd-ctl-hover);
    color: var(--wd-ctl-ink);
  }

  &:active {
    transform: scale(0.95);
  }
}

// ── Scroll fades (top + bottom) ───────────────────────────────────────
// INSIDE the rows container — sticky positioned so they stay visible
// while the content scrolls. They kiss the clipped rows, not the box.
.wd-ovl__fade {
  // STICKY: absolute children of a scroll container scroll WITH the
  // content; sticky stays pinned at the scroll viewport's edge.
  position: sticky;
  left: 0;
  z-index: 5;
  display: block;
  flex: none; // never shrink — a collapsed fade keeps its -12px margin and pulls the first row out of view
  height: 12px;
  pointer-events: none;
  transition: opacity 0.25s $ease;

  &--top {
    top: 0;
    margin-bottom: -12px; // no layout space
    background: linear-gradient(to bottom, var(--wd-ctl-bg) 80%, transparent);
  }

  &--bottom {
    bottom: 0;
    margin-top: -12px;
    background: linear-gradient(to top, var(--wd-ctl-bg) 80%, transparent);
  }

  &--hidden {
    opacity: 0;
  }
}

// ── Rows (scrollable) ────────────────────────────────────────────────────
// FIXED height: identical in mini and expanded — the box grows UP by the
// header height when expanding, so the icon chips never move a pixel.
.wd-ovl__rows {
  position: relative; // anchor for the absolute fades
  flex: 0 1 auto; // auto-grow to content (mini drives the height)
  // EXACT mini content height: rows pitch 42 + padding 6 + promoted block.
  // Matching natural height means expanding NEVER shifts the icons.
  max-height: calc((var(--mini-rows, 4) + var(--prom-count, 0)) * 42px + 6px + var(--prom-extra, 0px));
  overflow-y: auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  touch-action: pan-y;
  display: flex;
  flex-direction: column;
  padding: 2px 3px 4px 3px;
  position: relative;
  // native scrollbar REMOVED — it took layout space and squeezed the
  // 48px mini box (chips cut off on desktop). Custom overlay thumb above.
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

// custom overlay thumb: ON the box's right border (box-level so the
// rows' scroll clip cannot eat it). Mobile 3px; desktop 2px always-on.
.wd-ovl__scrollthumb {
  position: absolute;
  right: 0; // flush on the inner edge of the 1px box border
  width: 3px;
  border-radius: 999px;
  background: rgba(128, 145, 135, 0.55);
  pointer-events: none;
  z-index: 3;
  opacity: 1;
  transition: opacity 0.2s ease;

  &--end {
    opacity: 0.4; // reached the end — still visible, quieter
  }
}

@media (min-width: 900px) {
  .wd-ovl__scrollthumb {
    width: 1.5px; // hairline always visible on desktop
  }
}

/* Mobile: no scrollbar — the fades carry the affordance */
@media (max-width: 899px) {
  .wd-ovl__scrollthumb {
    display: none;
  }
}

// Mouse pan affordance: grab cursor over the list (desktop)
@media (min-width: 900px) and (pointer: fine) {
  .wd-ovl__rows {
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }
}

.wd-ovl__row {
  display: flex;
  flex-direction: row; // label-info … icon (DOM order = visual order)
  align-items: center;
  justify-content: flex-end;
  min-height: 40px;
  border-radius: 4px;
  // The row is part of the PANEL — gestures inside the box scroll/toggle,
  // they do not pan the map (the box wrapper still passes around itself).
  pointer-events: auto;
  cursor: pointer;
  transition: background-color 0.12s $ease;
  flex: none;
  margin: 1px 0;

  &:hover {
    background: var(--wd-ctl-hover);
  }

  &:active {
    background: var(--wd-ctl-active-bg);
  }
}

// ── Row info (expanded only): info icon | label | filter badge | filter ──
.wd-ovl__row-info {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 2px 0 8px;
  min-width: 0; // allow label to clip
  flex: 1;
  // In expanded mode the whole row is interactive (it's a panel).
  // In mini mode only the buttons need to be clickable.
  pointer-events: auto;
}

.wd-ovl__row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13.5px;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--wd-ctl-ink); /* passive-but-readable: 0.82 opacity below */
  opacity: 0.82;
  line-height: 1.2;
  pointer-events: none;
  transition: color 0.15s $ease, font-weight 0.15s $ease;
}

body.body--dark .wd-ovl__row-name {
  color: #cfe8dc; // brighter than ink-soft — passive but readable on pine
}


.wd-ovl__row--active .wd-ovl__row-name {
  font-weight: 600;
  color: var(--wd-ctl-ink);
}

.wd-ovl__row-action {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: none;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  pointer-events: auto;
  transition: background-color 0.12s $ease, color 0.12s $ease;

  &:hover {
    background: var(--wd-ctl-hover);
    color: var(--wd-ctl-ink);
  }

  &--info {
    color: #1f7a63; // turquoise touch (info = "learn more")
  }


  body.body--dark &--info {
    color: #7fe3c8;
  }
}

.wd-ovl__row-filter-badge {
  display: grid;
  place-items: center;
  width: 14px;
  height: 18px;
  flex: none;
  border-radius: 50%;
  background: $wd-gold; // gold
  color: #fdfefd;
  pointer-events: none;
}

// ── Icon button (ALWAYS at the right edge; bordered chip look) ───────────
.wd-ovl__icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 40px;
  height: 36px;
  margin: 0;
  border-radius: 4px;
  border: 1px solid var(--wd-ctl-border);
  background: var(--wd-ctl-date-bg);
  flex: none;
  transition:
    box-shadow 0.15s $ease,
    opacity 0.15s $ease;
  pointer-events: none; // the ROW handles the click (single handler)

  &--active {
    box-shadow: inset 0 0 0 1px var(--wd-ctl-ring);
    opacity: 1;
  }

  body.body--dark &--active {
    // !important escapes the global dark-mode elevation kill
    // (body.body--dark * { box-shadow: none !important }). The ring is
    // the ONLY edge (no border reservation) — reads exactly 2px.
    box-shadow: inset 0 0 0 2px $wd-gold-bright !important;
    border-color: transparent;
    border-width: 0;
  }

  &--inactive {
    opacity: 0.55; // clearly dimmer than active — instant read
  }

  :deep(img),
  :deep(.q-icon) {
    display: block;
  }
}

// Dark theme icon inversion lives in app.scss (global invert treatment)

// Filter-active indicator ON the chip (gold dot, top-right)
.wd-ovl__chip-filter {
  position: absolute;
  top: -3px;
  right: -3px;
  display: grid;
  place-items: center;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: $wd-gold;
  color: #fdfefd;
  pointer-events: none;
  z-index: 1;
}

// ── More button (chevron, more obvious) ─────────────────────────────────
.wd-ovl__more {
  display: grid;
  place-items: center;
  height: 26px;
  min-height: 26px;
  border: none;
  border-top: 1px solid var(--wd-ctl-border);
  background: transparent; // no tonal band against the rows above
  color: var(--wd-ctl-ink);
  cursor: pointer;
  flex: none;
  width: 100%;
  border-radius: 0 0 8px 8px;
  transition: background-color 0.12s $ease, color 0.12s $ease;
  pointer-events: auto;

  &:hover {
    background: var(--wd-ctl-hover);
  }
}

// ── Group selector (fixed at the bottom, above the more button) ─────────
// ── Group selector: spans the box width, clearly distinct ────────────────
.wd-ovl__group-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  align-self: stretch;
  height: 34px;
  padding: 0 6px;
  border: none;
  border-top: 1px solid var(--wd-ctl-border);
  border-radius: 0 0 8px 8px;
  background: var(--wd-ctl-date-bg);
  color: var(--wd-ctl-ink);
  cursor: pointer;
  flex: none;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;

  &:active {
    background: var(--wd-ctl-hover);
  }

  .wd-ovl__group-arrow {
    opacity: 0.4;
    flex: none;
  }
}

// ── Promoted layers separator (thin line above promoted rows) ──────────
.wd-ovl__promoted-sep {
  height: 1px;
  background: var(--wd-ctl-border);
  margin: 2px 6px;
  flex: none;
}

// ── "All layers" separator (expanded view) ───────────────────────────────
.wd-ovl__all-sep {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 4px;
  border-top: 1px solid var(--wd-ctl-border);
  margin-top: 4px;
  flex: none;
}

.wd-ovl__all-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--wd-ctl-ink);
  opacity: 0.78;
}

// Other-group rows: faded
.wd-ovl__row--other {
  .wd-ovl__row-name {
    opacity: 0.6;
  }
  .wd-ovl__icon {
    opacity: 0.7;
  }
}

// Open/close feedback: one soft overshoot pop (crafted moment)
@keyframes wd-ovl-pop {
  0% {
    transform: scale(0.985);
  }

  55% {
    transform: scale(1.008);
  }

  100% {
    transform: scale(1);
  }
}

// ── Transitions ──────────────────────────────────────────────────────────
.wd-ovl-strip-enter-active,
.wd-ovl-strip-leave-active {
  transition:
    opacity 0.22s $ease,
    transform 0.22s $ease;
}

.wd-ovl-strip-enter-from,
.wd-ovl-strip-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.wd-ovl-fade-enter-active,
.wd-ovl-fade-leave-active {
  transition: opacity 0.2s $ease;
}

.wd-ovl-fade-enter-from,
.wd-ovl-fade-leave-to {
  opacity: 0;
}

// ── EDIT MODE: maximized box ───────────────────────────────────────────
.wd-ovl__box--expanded:not(.wd-ovl__box--edit) {
  // The toolbar floats directly above — IT carries the top radius.
  // A rounded box top under a rounded toolbar reads as two stacked cards.
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.wd-ovl__box--edit {
  // As tall as the CONTENT needs, capped below the top map controls
  width: min(320px, calc(100vw - 48px));
  max-height: calc(100dvh - 160px); // fallback — inline style (measured) wins

  // Toolbar + edit bar become IN-FLOW headers (maximized box has room)
  .wd-ovl__toolbar {
    position: static;
    flex: none;
    border: none;
    border-bottom: 1px solid var(--wd-ctl-border);
    border-radius: 8px 8px 0 0;
  }

  .wd-ovl__edit-bar {
    position: static;
    flex: none;
    border-bottom: 1px solid var(--wd-ctl-border);
  }

  // Rows fill the remaining space
  .wd-ovl__rows {
    max-height: none !important;
    flex: 1 1 auto;
    min-height: 120px;
  }
}

// ── Edit action bar: icon-only, one row ────────────────────────────────
.wd-ovl__edit-bar {
  pointer-events: auto; // wheel/interaction must not reach the map
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
}

.wd-ovl__edit-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 30px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  transition: background-color 0.12s $ease, color 0.12s $ease;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    background: var(--wd-ctl-hover);
    color: var(--wd-ctl-ink);
  }

  &--danger {
    color: #c44e3b;
    &:hover { background: rgba(196, 78, 59, 0.08); }
  }

  &--add {
    color: #2a8a72;
    &:hover { background: rgba(42, 138, 114, 0.08); }
  }
}

.wd-ovl__edit-sep {
  flex: 1;
}

// ── Row actions (edit mode): add/remove from group ────────────────────
.wd-ovl__row-action--remove {
  color: #c44e3b;
  &:hover { background: rgba(196, 78, 59, 0.08); }
}

.wd-ovl__row-action--add {
  color: #2a8a72;
  &:hover { background: rgba(42, 138, 114, 0.08); }
}

// ── Drag handle (6-dot grip) ───────────────────────────────────────────
.wd-ovl__drag-handle {
  display: grid;
  place-items: center;
  width: 20px;
  height: 100%;
  flex: none;
  color: var(--wd-ctl-ink-soft);
  opacity: 0.4;
  cursor: grab;
  pointer-events: auto;
  touch-action: none; // touch drag must NOT scroll the list
}

// ── Drop line: gold insertion marker at the exact drop position ────────
.wd-ovl__row--drop-above {
  box-shadow: inset 0 2px 0 0 #bfab2d;
}

.wd-ovl__row--drop-below {
  box-shadow: inset 0 -2px 0 0 #bfab2d;
}

// ── Drop zone on "All layers" separator ────────────────────────────────
.wd-ovl__all-sep {
  pointer-events: auto; // opt back in — the box is pointer-events:none
}

.wd-ovl__all-sep--drop {
  background: rgba(191, 171, 37, 0.12);
  border-top: 2px dashed rgba(191, 171, 37, 0.5);
  cursor: alias;
}

// ── Footer: cancel (X) + confirm (✓) on ONE line ──────────────────────
.wd-ovl__more-group {
  display: flex;
  width: 100%;
  flex: none;
  border-top: 1px solid var(--wd-ctl-border);
  pointer-events: auto;
}

.wd-ovl__more-group .wd-ovl__more {
  flex: 1;
  height: 38px;
  border-radius: 0;
  border-top: none;
}

.wd-ovl__more-group .wd-ovl__more--cancel {
  border-bottom-left-radius: 8px;
  border-right: 1px solid var(--wd-ctl-border);
  color: var(--wd-ctl-ink-soft);

  &:hover { background: var(--wd-ctl-hover); }
}

.wd-ovl__more-group .wd-ovl__more--confirm {
  border-bottom-right-radius: 8px;
  color: #2a8a72;
  background: rgba(42, 138, 114, 0.07);

  &:hover { background: rgba(42, 138, 114, 0.14); }
}

</style>
