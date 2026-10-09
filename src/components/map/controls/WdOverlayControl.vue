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
import { useDebounceFn } from '@vueuse/core';
import WdBackendIcon from '@components/media/WdBackendIcon.vue';
import { DEFAULT_ICON_PACK, searchIcons, type BackendIcon } from '@services/icons';
import { useConfirmPopover } from '@composables/useConfirmPopover';
import {
  isDefaultGroupSlug,
  resetGroupToDefault,
  groupDisplayName,
  type LayerGroup,
} from '@stores/map/utils/layer-groups';
import { withOverlayMinZoom } from '@stores/map/utils/map-constants';
import { useI18n } from 'vue-i18n';
import { LocalStorage } from 'quasar';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import type { AllPaintProperties } from '@maplibre/maplibre-gl-style-spec';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useBasemapStore } from '@stores/map/basemap-store';
import { useOverlayConfigStore } from '@stores/map/overlay-config-store';
import { useMapMenuStore } from '@stores/map/map-menu-store';
import { OpacitySpecification, OverlaySwitchItem } from '@stores/map/utils/interfaces';
import type {
  LayerSpecification,
  PropertyValueSpecification,
  Map as MapLibreMap,
} from 'maplibre-gl';

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
/** Insertion line position (px, inside the rows scroller) — null = hidden */
const dropLineTop = ref<number | null>(null);
/** Pointer position while dragging — drives the floating ghost chip */
const dragPointer = ref<{ x: number; y: number } | null>(null);
const draggedItem = computed(() =>
  dragSlug.value ? (overlayStore.overlays.find(o => o.name === dragSlug.value) ?? null) : null
);
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
  const hit = el?.closest('.wd-ovl__row, .wd-ovl__sep') as HTMLElement | null;
  if (!hit) return {};
  // The whole More-layers section is the UNGROUP zone: the separator
  // AND its rows (they have no user order — no insertion there)
  if (hit.classList.contains('wd-ovl__sep') || hit.classList.contains('wd-ovl__row--other')) {
    return { sep: true };
  }
  return { row: hit.dataset.slug ?? undefined };
}

/** Update the drop marker from the pointer position (also re-run while
 *  auto-scrolling — content moves under a stationary pointer). */
let lastDragEv: PointerEvent | null = null;
function updateDropTarget(ev: PointerEvent): void {
  const hit = hitTarget(ev);
  dropOnSep.value = !!hit.sep;
  if (hit.row && hit.row !== dragSlug.value) {
    dragOverSlug.value = hit.row;
    const rowEl = document.querySelector(`.wd-ovl__row[data-slug="${hit.row}"]`);
    if (rowEl) {
      const r = rowEl.getBoundingClientRect();
      dropPos.value = ev.clientY < r.top + r.height / 2 ? 'above' : 'below';
      // Insertion LINE: a real element, dashed, no radius — pinned to the
      // row's boundary in CONTENT coordinates (scrolls with the list)
      const rowBox = rowEl as HTMLElement;
      dropLineTop.value =
        dropPos.value === 'above'
          ? rowBox.offsetTop - 1
          : rowBox.offsetTop + rowBox.offsetHeight - 1;
      return;
    }
  }
  dragOverSlug.value = null;
  dropLineTop.value = null;
}

// ── Edge auto-scroll while dragging (long lists) ─────────────────────
const EDGE = 40; // px from the scroller edge that triggers scrolling
const SCROLL_VEL = 9; // px per frame
let dragScrollVel = 0;
let dragScrollRaf = 0;

function dragScrollLoop(): void {
  const rows = rowsEl.value;
  if (dragSlug.value && rows && dragScrollVel !== 0) {
    rows.scrollTop += dragScrollVel;
    if (lastDragEv) updateDropTarget(lastDragEv);
    dragScrollRaf = window.requestAnimationFrame(dragScrollLoop);
  } else {
    dragScrollRaf = 0;
  }
}

function updateDragScroll(ev: PointerEvent): void {
  const rows = rowsEl.value;
  if (!rows || !dragSlug.value) {
    dragScrollVel = 0;
    return;
  }
  const r = rows.getBoundingClientRect();
  const inTop = ev.clientY >= r.top && ev.clientY < r.top + EDGE;
  const inBottom = ev.clientY <= r.bottom && ev.clientY > r.bottom - EDGE;
  const vel = inTop ? -SCROLL_VEL : inBottom ? SCROLL_VEL : 0;
  if (vel !== dragScrollVel) {
    dragScrollVel = vel;
    if (vel !== 0 && !dragScrollRaf) dragScrollRaf = window.requestAnimationFrame(dragScrollLoop);
  }
}

function onHandlePointerMove(ev: PointerEvent): void {
  if (!pendingDrag) return;
  if (!dragSlug.value) {
    // start dragging after a small threshold (avoid accidental taps)
    if (Math.hypot(ev.clientX - pendingDrag.startX, ev.clientY - pendingDrag.startY) < 8) return;
    dragSlug.value = pendingDrag.slug;
  }
  lastDragEv = ev;
  dragPointer.value = { x: ev.clientX, y: ev.clientY };
  updateDropTarget(ev);
  updateDragScroll(ev);
}

/** Capture-phase click interceptor right after a drag: the pointer-up is
 *  followed by a CLICK on whatever sits under the pointer — row buttons
 *  (info/filter/add) must never fire as a drag after-shock. */
function suppressClickOnce(): void {
  const swallow = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', swallow, true), 200);
}

function onHandlePointerUp(ev: PointerEvent): void {
  if (dragSlug.value) {
    suppressClickOnce();
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
  dropLineTop.value = null;
  lastDragEv = null;
  dragPointer.value = null;
  dragScrollVel = 0; // loop exits on its own next frame
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
  // Not in the active group → nothing to ungroup (others-row on others-row)
  if (!group || !group.layerSlugs.includes(sourceSlug)) return;
  group.layerSlugs = group.layerSlugs.filter(s => s !== sourceSlug);
  group.activeLayerSlugs = group.activeLayerSlugs.filter(s => s !== sourceSlug);
  overlayStore.syncGroupSettings();
  markEdited();
}

// Track unsaved edits — the header ✓ exits edit mode; when dirty it
// asks Save / Discard (esc keeps editing). One exit path, no footer pair.
const hasEdits = ref(false);
const snapshotGroups = ref<string>('');

function takeSnapshot(): void {
  snapshotGroups.value = JSON.stringify(overlayStore.groupSettings.groups);
  hasEdits.value = false;
}

/** Outside edit mode a hidden group must never stay active (cycling
 *  skips hidden ones — the group button would offer a switch to itself).
 *  Leaving edit mode always lands on a visible group. */
function ensureVisibleActiveGroup(): void {
  const active = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  if (!active || active.hidden || active.removed) {
    overlayStore.cycleGroup(false);
    applyGroupStateToMap();
  }
}

const { confirmAt } = useConfirmPopover();

/** Footer: revert to the snapshot and exit edit mode — behind a
 *  confirm (discarding is destructive on a mobile footer tap) */
function cancelEdit(): void {
  if (!hasEdits.value) {
    editMode.value = false;
    return;
  }
  confirmAt({
    okLabel: t('overlays.edit_discard'),
    okVariant: 'danger',
    message: t('overlays.edit_unsaved_message'),
    onOk: () => {
      if (snapshotGroups.value) {
        overlayStore.groupSettings.groups = JSON.parse(snapshotGroups.value);
        overlayStore.syncGroupSettings();
      }
      editMode.value = false;
      hasEdits.value = false;
      ensureVisibleActiveGroup();
    },
  });
}

/** Footer: keep the changes and exit edit mode — behind a confirm */
function confirmEdit(): void {
  if (!hasEdits.value) {
    editMode.value = false;
    return;
  }
  confirmAt({
    okLabel: t('overlays.edit_save'),
    okVariant: 'go',
    message: t('overlays.edit_unsaved_message'),
    cancelLabel: t('overlays.edit_keep_editing'),
    onOk: () => {
      editMode.value = false;
      hasEdits.value = false;
    },
  });
}

function toggleEditMode(): void {
  if (!editMode.value) {
    updateBoxCap();
    // Edit mode needs the full list + the toolbar — always expand first
    expanded.value = true;
    editMode.value = true;
    takeSnapshot();
    hasEdits.value = false;
    return;
  }
  if (hasEdits.value) {
    // Pointer-anchored 3-way: Save / Discard / keep editing
    confirmAt({
      message: t('overlays.edit_unsaved_message'),
      okLabel: t('overlays.edit_save'),
      okVariant: 'go',
      dangerLabel: t('overlays.edit_discard'),
      cancelLabel: t('overlays.edit_keep_editing'),
      onOk: () => {
        editMode.value = false;
        hasEdits.value = false;
      },
      onDanger: () => {
        if (snapshotGroups.value) {
          overlayStore.groupSettings.groups = JSON.parse(snapshotGroups.value);
          overlayStore.syncGroupSettings();
        }
        editMode.value = false;
        hasEdits.value = false;
        ensureVisibleActiveGroup();
      },
    });
    return;
  }
  editMode.value = false;
  ensureVisibleActiveGroup();
}

function markEdited(): void {
  if (editMode.value)
    hasEdits.value = JSON.stringify(overlayStore.groupSettings.groups) !== snapshotGroups.value;
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

const HUTS_SLUG = 'huts';

function addGroupWithName(name: string): void {
  const group = {
    id:
      typeof window !== 'undefined' && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    icon: 'hiking-boot',
    // New groups start with the huts layer, enabled — like the defaults
    layerSlugs: [HUTS_SLUG],
    activeLayerSlugs: [HUTS_SLUG],
    hidden: false,
    removed: false,
    locked: false,
    sortOrder: overlayStore.groupSettings.groups.length,
  };
  overlayStore.groupSettings.groups.push(group);
  overlayStore.groupSettings.activeGroupId = group.id;
  overlayStore.syncGroupSettings();
  markEdited();
  // Implicit icon: backend search by the group name, take the best hit
  // ('Climbing' → person-climbing)
  void pickIconForNewGroup(group.id, name);
}

async function pickIconForNewGroup(groupId: string, name: string): Promise<void> {
  let icons: BackendIcon[];
  try {
    icons = await searchIcons({ search: name, pack: DEFAULT_ICON_PACK, limit: 20 });
  } catch {
    return;
  }
  if (icons.length === 0) return;
  const group = overlayStore.groupSettings.groups.find(g => g.id === groupId);
  if (!group || group.id !== overlayStore.groupSettings.activeGroupId) return;
  // Prefer a hit whose slug CARRIES the query ('Climbing' →
  // person-climbing) — guards against odd fuzzy matches
  const needle = name.trim().toLowerCase().slice(0, 5);
  const preferred = icons.find(icon => icon.slug.includes(needle));
  group.icon = (preferred ?? icons[0]).slug;
  overlayStore.syncGroupSettings();
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
    prompt: {
      model: overlayStore.activeGroupName(t),
      type: 'text',
      outlined: true,
      label: t('overlays.group_name'),
    },
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

/** Toggle the active group's hidden flag (edit mode). The group STAYS
 *  selected — the crossed eye shows the state — and non-edit cycling
 *  skips it (it only truly disappears outside edit mode). */
function toggleGroupHidden(): void {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  if (!group) return;
  group.hidden = !group.hidden;
  overlayStore.syncGroupSettings();
  markEdited();
}

const isGroupHidden = computed(() => {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  return group?.hidden ?? false;
});

/** Delete the active group (pointer-anchored confirm) */
function confirmDeleteGroup(): void {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  if (!group) return;
  confirmAt({
    message: t('overlays.group_delete_confirm', { name: overlayStore.activeGroupName(t) }),
    okLabel: t('overlays.group_delete'),
    okVariant: 'danger',
    onOk: () => deleteActiveGroup(),
  });
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
  setTimeout(updateBoxCap, 450); // box cap needs the laid-out controls
  rowsResizeObserve();
});

function rowsResizeObserve(): void {
  const rows = document.querySelector('.wd-ovl__rows') as HTMLElement | null;
  if (!rows) return;
  const RO = (
    window as unknown as {
      ResizeObserver?: new (cb: () => void) => { observe: (el: HTMLElement) => void };
    }
  ).ResizeObserver;
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
  pulseChip(item.name);
}

// Toggle feedback: a quick chip pulse acknowledges the flip
const toggledSlug = ref<string | null>(null);
let togglePulseTimer: ReturnType<typeof setTimeout> | null = null;

function pulseChip(slug: string): void {
  toggledSlug.value = slug;
  if (togglePulseTimer) clearTimeout(togglePulseTimer);
  togglePulseTimer = setTimeout(() => {
    toggledSlug.value = null;
  }, 280);
}

/** Swipe left = expand, swipe right = collapse (on rows and toggle) */
let swipeStartX: number | null = null;
function onSwipeStart(e: Event): void {
  swipeStartX =
    (e as unknown as { touches: Array<{ clientX: number }> }).touches[0]?.clientX ?? null;
}
function onSwipeEnd(e: Event): void {
  if (swipeStartX === null) return;
  const endX =
    (e as unknown as { changedTouches: Array<{ clientX: number }> }).changedTouches[0]?.clientX ??
    swipeStartX;
  const delta = endX - swipeStartX;
  swipeStartX = null;
  if (Math.abs(delta) < 30) return;
  if (delta < 0) expanded.value = true;
  else if (delta > 0) expanded.value = false;
}

/** Click outside the control collapses the expanded box */
function onDocClick(ev: Event): void {
  const target = ev.target as HTMLElement;
  // q-menu / q-dialog TELEPORT to <body> — their clicks are ours too
  // (the group dropdown must not collapse the box)
  if (target.closest('.wd-ovl, .q-menu, .q-dialog')) return;
  // In edit mode, never auto-close — the user must explicitly exit
  if (editMode.value) return;
  expanded.value = false;
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
/** Box height cap (ALL modes): stay 1 button-height below the top-right
 *  map controls (desktop: geolocate/nav cluster y≈58-274) and below the
 *  topbar — same rule that made edit mode feel right. Measured live —
 *  CSS alone can't know the control cluster's height. The box bottom is
 *  anchored, so the measurement is stable whatever the current height. */
const boxMaxH = ref<number | null>(null);
function updateBoxCap(): void {
  const boxEl = document.querySelector('.wd-ovl__box');
  if (!boxEl) return;
  const boxBottom = boxEl.getBoundingClientRect().bottom;
  let limit = 0;
  const topbar = document.querySelector('.wd-topbar');
  if (topbar) limit = Math.max(limit, topbar.getBoundingClientRect().bottom);
  const ctrls = document.querySelector('.maplibregl-ctrl-top-right');
  if (ctrls) limit = Math.max(limit, ctrls.getBoundingClientRect().bottom);
  boxMaxH.value = Math.max(220, Math.round(boxBottom - limit - 48));
}
window.addEventListener('resize', () => updateBoxCap());

// The box bottom is anchored, but re-measure on state changes anyway —
// cheap, and covers strip reopen / layout shifts from the topbar.
watch([stripOpen, expanded, () => overlayStore.groupSettings.activeGroupId], () => {
  nextTick(() => updateBoxCap());
});

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

// ── Promoted rows & 6s linger grace ─────────────────────────────────────
// Layers NOT in the active group live in ONE section under the group rows,
// selected first. When such a layer is switched OFF it lingers in place for
// LINGER_MS before dropping away — switch it back on inside the window and
// it simply stays (no accidental-loss moment, no hunt through the list).
const LINGER_MS = 6000;
const lingeringSlugs = ref(new Set<string>());
const lingerTimers = new Map<string, ReturnType<typeof setTimeout>>();

function startLinger(slug: string): void {
  if (lingeringSlugs.value.has(slug)) return; // already lingering — keep its timer
  const next = new Set(lingeringSlugs.value);
  next.add(slug);
  lingeringSlugs.value = next;
  lingerTimers.set(
    slug,
    setTimeout(() => stopLinger(slug), LINGER_MS)
  );
}

function stopLinger(slug: string): void {
  const timer = lingerTimers.get(slug);
  if (timer) {
    clearTimeout(timer);
    lingerTimers.delete(slug);
  }
  if (lingeringSlugs.value.has(slug)) {
    const next = new Set(lingeringSlugs.value);
    next.delete(slug);
    lingeringSlugs.value = next;
  }
}

/** Reconcile lingering state against every path that flips layers:
 *  row taps, resets, edit-mode changes. GROUP SWITCHES are exempt: the
 *  previous group's layers are replaced wholesale by the new group's
 *  view, so no grace window — lingering rows drop immediately and none
 *  are started (the mini strip shows exactly the new group's layers). */
let prevActive: Map<string, boolean> | null = null;
let prevGroupId: string | null | undefined;
watch(
  () => {
    const group = overlayStore.groupSettings.groups.find(
      g => g.id === overlayStore.groupSettings.activeGroupId
    );
    const states = (overlayStore.overlays as unknown as Array<{ name: string; active?: boolean }>)
      .map(o => `${o.name}:${o.active ? 1 : 0}`)
      .join('|');
    return `${overlayStore.groupSettings.activeGroupId}#${group?.layerSlugs.join(',') ?? ''}#${states}`;
  },
  () => {
    const groupId = overlayStore.groupSettings.activeGroupId;
    const group = overlayStore.groupSettings.groups.find(g => g.id === groupId);
    const groupSlugs = new Set(group?.layerSlugs ?? []);
    const current = new Map<string, boolean>();
    for (const o of overlayStore.overlays as unknown as Array<{ name: string; active?: boolean }>) {
      current.set(o.name, o.active === true);
    }
    const groupSwitched = prevGroupId !== undefined && prevGroupId !== groupId;
    if (groupSwitched) {
      // Group switch: replace the layer set without the 6s linger
      for (const slug of [...lingeringSlugs.value]) stopLinger(slug);
    } else if (prevActive) {
      for (const [slug, wasActive] of prevActive) {
        if (wasActive && !(current.get(slug) ?? false) && !groupSlugs.has(slug)) {
          startLinger(slug); // freshly disabled non-group layer → grace window
        }
      }
      for (const slug of [...lingeringSlugs.value]) {
        if (current.get(slug) || groupSlugs.has(slug)) stopLinger(slug); // back on / absorbed
      }
    }
    prevActive = current;
    prevGroupId = groupId;
  },
  { immediate: true }
);

/** Non-group layers in render order: selected first, then the rest.
 *  Lingering rows keep their GLOBAL overlay-order slot (interleaved with
 *  the actives) — a switched-off layer does not move for LINGER_MS. */
const otherLayersSorted = computed(() => {
  const orderOf = new Map(
    (overlayStore.overlays as unknown as Array<{ name: string }>).map(
      (o, i) => [o.name, i] as const
    )
  );
  const isRest = (o: OverlaySwitchItem): boolean => !o.active && !lingeringSlugs.value.has(o.name);
  return overlayStore
    .otherLayers()
    .slice()
    .sort((a, b) => {
      const r = Number(isRest(a)) - Number(isRest(b));
      return r !== 0 ? r : (orderOf.get(a.name) ?? 999) - (orderOf.get(b.name) ?? 999);
    });
});

/** Rows that render: mini shows active + lingering only; expanded/edit show all.
 *  Same keys and DOM in both states — rows above the fold never shift. */
const visibleOthers = computed(() => {
  if (expanded.value || editMode.value) return otherLayersSorted.value;
  return otherLayersSorted.value.filter(o => o.active || lingeringSlugs.value.has(o.name));
});

/** Mini height cap: group rows + visible promoted rows (linger included) */
const cappedPromotedCount = computed(
  () => overlayStore.otherLayers().filter(o => o.active || lingeringSlugs.value.has(o.name)).length
);

// The rows BOX is the same size in mini and expanded (pixel-perfect
// design) — the ResizeObserver never fires on state changes. Re-measure
// when the CONTENT changes, or the thumb goes stale (mini after scroll).
// NOTE: must stay BELOW the miniLayers/visibleOthers/cappedPromotedCount
// declarations — watch() evaluates its getters immediately and would hit
// the temporal dead zone otherwise (ReferenceError on hut pages, breaking
// the overlay control; seen as "Cannot access 'miniLayers' before
// initialization" on staging).
watch(
  [
    expanded,
    () => miniLayers.value.length,
    () => visibleOthers.value.length,
    () => cappedPromotedCount.value,
  ],
  () => nextTick(measureThumb)
);

/** Reset the active group to its predefined definition — behind a
 *  pointer-anchored confirm (it discards the user's customization) */
function confirmResetGroup(): void {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  if (!group) return;
  confirmAt({
    message: t('overlays.group_reset_confirm', { name: overlayStore.activeGroupName(t) }),
    okLabel: t('overlays.group_reset'),
    okVariant: 'go',
    onOk: () => resetGroup(),
  });
}

// ── Group icon picker (edit mode) ────────────────────────────────────────
const showIconPicker = ref(false);

/** Group icon slugs — Fluent Emoji (Flat/simple style) via the backend
 *  icon library (openspec: icon-library): one coherent set, MIT-licensed,
 *  reads at small sizes. Curated activity shortlist for the common grid;
 *  everything else via localized backend search. A stored group icon is
 *  the bare slug in the default pack, rendered by WdBackendIcon. */
const COMMON_ICON_SLUGS = [
  'hiking-boot',
  'tent',
  'camping',
  'national-park',
  'mountain',
  'snow-capped-mountain',
  'skier',
  'snowboarder',
  'bicycle',
  'person-biking',
  'person-climbing',
  'mountain-cableway',
  'sun',
  'sun-behind-cloud',
  'snowflake',
  'compass',
  'fire',
  'sled',
] as const;

/** Common set: the curated Fluent Emoji (Flat) activity shortlist */
const groupIconChoices = COMMON_ICON_SLUGS;

// ── Backend icon search (custom icons beyond the common set) ──────
const iconQuery = ref('');
interface IconChoice {
  slug: string;
  url: string | null;
}
const iconResults = ref<IconChoice[]>([]);
/** Lazy reveal: fetches up to 60, renders in chunks of 32 */
const iconVisibleCount = ref(32);
const iconSearching = ref(false);
const iconSearchError = ref(false);
const visibleIconResults = computed(() => iconResults.value.slice(0, iconVisibleCount.value));

/** Flat (simple) is the app's emoji look — fall back to any style. */
function pickIconUrl(icon: BackendIcon): string | null {
  return icon.urls?.simple ?? icon.urls?.detailed ?? icon.urls?.mono ?? null;
}

async function runIconSearch(query: string): Promise<void> {
  const q = query.trim();
  iconVisibleCount.value = 32;
  if (q.length < 2) {
    iconResults.value = [];
    iconSearchError.value = false;
    return;
  }
  iconSearching.value = true;
  iconSearchError.value = false;
  try {
    // The backend ranks localized keywords and slugs (exact > prefix >
    // substring > fuzzy) and unions the UI language with English — no
    // client-side fallbacks needed.
    const icons = await searchIcons({ search: q, pack: DEFAULT_ICON_PACK, limit: 60 });
    iconResults.value = icons.map(icon => ({ slug: icon.slug, url: pickIconUrl(icon) }));
  } catch {
    iconResults.value = [];
    iconSearchError.value = true;
  } finally {
    iconSearching.value = false;
  }
}



/** Auto lazy-load: sentinel enters the viewport → reveal the next chunk */
const iconMoreSentinel = ref<HTMLElement | null>(null);
let iconObserver: IntersectionObserver | null = null; // eslint-disable-line no-undef

watch(iconMoreSentinel, el => {
  iconObserver?.disconnect();
  iconObserver = null;
  if (!el || typeof window.IntersectionObserver === 'undefined') return;
  iconObserver = new window.IntersectionObserver(
    entries => {
      if (entries.some(e => e.isIntersecting)) {
        iconVisibleCount.value += 32;
      }
    },
    { root: el.closest('.wd-ovl__icon-grid'), rootMargin: '120px' }
  );
  iconObserver.observe(el);
});

onBeforeUnmount(() => iconObserver?.disconnect());

const searchIconsDebounced = useDebounceFn((q: string) => runIconSearch(q), 350);
watch(iconQuery, q => searchIconsDebounced(q));
watch(showIconPicker, open => {
  if (!open) {
    iconQuery.value = '';
    iconResults.value = [];
  }
});

const activeGroupIconName = computed(() => {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  return group?.icon ?? '';
});

function applyGroupIcon(icon: string): void {
  const group = overlayStore.groupSettings.groups.find(
    g => g.id === overlayStore.groupSettings.activeGroupId
  );
  if (!group) return;
  group.icon = icon;
  overlayStore.syncGroupSettings();
  markEdited();
  showIconPicker.value = false;
}

/** Group cycling only makes sense with more than one group to cycle to.
 *  Edit mode cycles hidden groups too — count those there. */
const groupCycleable = computed(() => {
  const activeId = overlayStore.groupSettings.activeGroupId;
  const pool = editMode.value
    ? overlayStore.groupSettings.groups.filter(g => !g.removed)
    : overlayStore.visibleGroups();
  return pool.some(g => g.id !== activeId);
});

/** Groups for the title dropdown: quick switch. Edit mode lists hidden
 *  groups too (they stay editable/manageable there). */
const groupMenuChoices = computed<LayerGroup[]>(() =>
  editMode.value
    ? overlayStore.groupSettings.groups.filter(g => !g.removed)
    : overlayStore.visibleGroups()
);

/** The map must follow every group change: newly-active layers that were
 *  never added get ADDED (a group's saved actives from a previous session
 *  were never added this session); the rest get visibility re-applied. */
function applyGroupStateToMap(): void {
  const order = getOverlaysInRenderOrder();
  for (const item of overlayStore.overlays as unknown as OverlaySwitchItem[]) {
    if (item.active && !addedOverlays.has(item.name)) {
      addOverlay(item, order);
    } else {
      setOverlayVisibility(item);
    }
  }
}

/** Title dropdown: switch directly to a group */
function onGroupMenuSelect(groupId: string): void {
  overlayStore.setActiveGroup(groupId, editMode.value);
  applyGroupStateToMap();
}

/** Icon swap slides horizontally, direction-aware */
const groupSwapDir = ref<'fwd' | 'back'>('fwd');

function onGroupStepTap(step: -1 | 1): void {
  groupSwapDir.value = step > 0 ? 'fwd' : 'back';
  overlayStore.stepGroup(step, editMode.value);
  applyGroupStateToMap();
}

/** Handle group selector tap */
function onGroupSelectorTap(): void {
  groupSwapDir.value = 'fwd';
  overlayStore.cycleGroup(editMode.value);
  applyGroupStateToMap();
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
  // World/globe view: overlays never render below the zoom floor — layers
  // reappear automatically when the camera zooms back in (see
  // map-constants.ts; the same clamp is applied in transformStyle for
  // basemap switches)
  layer = withOverlayMinZoom(layer) as typeof layer;
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
function bindMap(map: MapLibreMap): void {
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
  const overlay = (overlayStore.overlays as unknown as OverlaySwitchItem[]).find(
    (o: OverlaySwitchItem) => o.name === overlayName
  );
  menuStore.openOverlayConfig(overlayName, tab);
  menuStore.menuData.title = overlay?.label ?? overlayName;
}

function hasInfo(overlayName: string): boolean {
  const overlay = overlayStore.overlays.find(o => o.name === overlayName);
  return !!overlay?.config?.legend?.sections?.length;
}

function hasFilterConfig(overlayName: string): boolean {
  const overlay = overlayStore.overlays.find(o => o.name === overlayName);
  return !!overlay?.config?.filters?.length;
}

function hasActiveFilters(overlayName: string): boolean {
  const overlay = (overlayStore.overlays as unknown as OverlaySwitchItem[]).find(
    (o: OverlaySwitchItem) => o.name === overlayName
  );
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
  for (const timer of lingerTimers.values()) clearTimeout(timer);
  lingerTimers.clear();
  if (dragScrollRaf) window.cancelAnimationFrame(dragScrollRaf);
});
</script>

<template>
  <div class="wd-ovl">
    <!-- ── THE BOX: mini strip (collapsed) or expanded (same box, wider) ── -->
    <Transition name="wd-ovl-strip">
      <div
        v-if="stripOpen"
        class="wd-ovl__box"
        :class="{
          'wd-ovl__box--expanded': expanded,
          'wd-ovl__box--edit': editMode,
          'wd-ovl__box--btnless': !groupCycleable,
        }"
        :style="{
          '--mini-rows': miniLayers.length,
          '--prom-count': cappedPromotedCount,
          '--prom-extra': cappedPromotedCount > 0 ? '20px' : '0px',
          ...(boxMaxH ? { maxHeight: boxMaxH + 'px' } : {}),
        }"
      >
        <!-- Top toolbar: EXTENDED only. The box grows UP by this height
             (max-height compensates) so the icon rows NEVER move.
             EDIT MODE lives entirely in this one header line — no second
             bar: [icon] title … [eye-show when hidden] [+] [⋮] [✓] -->
        <div v-if="expanded" class="wd-ovl__toolbar" @wheel.prevent>
          <button
            class="wd-ovl__toolbar-icon"
            :class="{ 'wd-ovl__toolbar-icon--pick': editMode }"
            :aria-label="editMode ? t('overlays.icon_change') : overlayStore.activeGroupName(t)"
            :title="editMode ? t('overlays.icon_change') : undefined"
            :disabled="!editMode"
            @click.stop="editMode && (showIconPicker = true)"
          >
            <WdBackendIcon :slug="overlayStore.activeGroupIcon()" :size="16" />
          </button>
          <!-- Group NAME = quick switch dropdown (expanded + edit).
               Icon → change icon (edit); name → switch group. -->
          <button
            v-if="groupMenuChoices.length > 0"
            class="wd-ovl__toolbar-title wd-ovl__toolbar-title--menu"
            :aria-label="t('overlays.group_switch', { name: overlayStore.activeGroupName(t) })"
            :title="t('overlays.group_switch', { name: overlayStore.activeGroupName(t) })"
            @click.stop
          >
            <span class="wd-ovl__toolbar-title-text">{{ overlayStore.activeGroupName(t) }}</span>
            <svg
              class="wd-ovl__toolbar-title-caret"
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            <q-menu anchor="bottom start" self="top start" class="wd-ovl__menu wd-ovl__group-menu">
              <q-list dense style="min-width: 170px">
                <q-item
                  v-for="g in groupMenuChoices"
                  :key="g.id"
                  clickable
                  v-close-popup
                  :class="{
                    'wd-ovl__group-menu-item--active':
                      g.id === overlayStore.groupSettings.activeGroupId,
                  }"
                  @click="onGroupMenuSelect(g.id)"
                >
                  <q-item-section avatar>
                    <WdBackendIcon :slug="g.icon" :size="16" />
                  </q-item-section>
                  <q-item-section>{{ groupDisplayName(g.name, t) }}</q-item-section>
                  <!-- Hidden marker (edit mode lists hidden groups too) -->
                  <q-item-section v-if="g.hidden" side>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                      <path d="M4 4l16 16" stroke-linecap="round" />
                    </svg>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </button>
          <span v-else class="wd-ovl__toolbar-title">{{ overlayStore.activeGroupName(t) }}</span>
          <div class="wd-ovl__toolbar-actions">
            <!-- Hidden group: one-tap unhide, right in the header -->
            <button
              v-if="editMode && isGroupHidden"
              class="wd-ovl__toolbar-btn wd-ovl__toolbar-btn--warn"
              :aria-label="t('overlays.group_show')"
              :title="t('overlays.group_show')"
              @click.stop="toggleGroupHidden"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
                <path d="M4 4l16 16" stroke-linecap="round" />
              </svg>
            </button>
            <button
              v-if="editMode"
              class="wd-ovl__toolbar-btn wd-ovl__toolbar-btn--add"
              :aria-label="t('overlays.group_add')"
              :title="t('overlays.group_add')"
              @click.stop="addNewGroup"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button
              v-if="editMode"
              class="wd-ovl__toolbar-btn"
              :aria-label="t('overlays.group_more')"
              :title="t('overlays.group_more')"
              @click.stop
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.7" />
                <circle cx="12" cy="12" r="1.7" />
                <circle cx="12" cy="19" r="1.7" />
              </svg>
              <q-menu anchor="bottom right" self="top right" class="wd-ovl__menu">
                <q-list dense style="min-width: 200px">
                  <q-item clickable v-close-popup @click="startRename">
                    <q-item-section avatar>
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                      >
                        <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
                      </svg>
                    </q-item-section>
                    <q-item-section>{{ t('overlays.group_rename') }}</q-item-section>
                  </q-item>
                  <q-item clickable v-close-popup @click="showIconPicker = true">
                    <q-item-section avatar>
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                      >
                        <rect x="3" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="3" width="7" height="7" rx="1.5" />
                        <rect x="3" y="14" width="7" height="7" rx="1.5" />
                        <rect x="14" y="14" width="7" height="7" rx="1.5" />
                      </svg>
                    </q-item-section>
                    <q-item-section>{{ t('overlays.icon_change') }}</q-item-section>
                  </q-item>
                  <q-item clickable v-close-popup @click="toggleGroupHidden">
                    <q-item-section avatar>
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                      >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                        <path v-if="isGroupHidden" d="M4 4l16 16" stroke-linecap="round" />
                      </svg>
                    </q-item-section>
                    <q-item-section>{{
                      isGroupHidden ? t('overlays.group_show') : t('overlays.group_hide')
                    }}</q-item-section>
                  </q-item>
                  <q-item v-if="isDefaultGroup" clickable v-close-popup @click="confirmResetGroup">
                    <q-item-section avatar>
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M3 12a9 9 0 1 0 2.6-6.4" />
                        <path d="M3 4v4h4" />
                        <path d="M12 8v4l3 2" />
                      </svg>
                    </q-item-section>
                    <q-item-section>{{ t('overlays.group_reset') }}</q-item-section>
                  </q-item>
                  <q-separator />
                  <q-item
                    clickable
                    v-close-popup
                    class="wd-ovl__menu-item--danger"
                    @click="confirmDeleteGroup"
                  >
                    <q-item-section avatar>
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                      >
                        <path
                          d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"
                        />
                      </svg>
                    </q-item-section>
                    <q-item-section>{{ t('overlays.group_delete') }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </button>
            <button
              class="wd-ovl__toolbar-btn"
              :class="{ 'wd-ovl__toolbar-btn--active': editMode }"
              :aria-label="editMode ? t('overlays.edit_done') : t('overlays.edit_groups')"
              @click.stop="toggleEditMode"
            >
              <svg
                v-if="!editMode"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
              </svg>
              <svg
                v-else
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Rows: icon always at the right, label+actions appear when expanded -->
        <!-- The WRAP carries the height cap + the fades (absolute, flush
             with the visible edges, clipped by the rounded corners). -->
        <div class="wd-ovl__rows-wrap">
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
            <!-- Empty group (edit mode): a quiet pointer to the + buttons below -->
            <div v-if="editMode && miniLayers.length === 0" class="wd-ovl__empty-hint">
              {{ t('overlays.group_empty_hint') }}
            </div>
            <TransitionGroup name="wd-ovl-row">
              <div
                v-for="item in miniLayers"
                :key="`g-${item.name}`"
                v-show="item.show"
                class="wd-ovl__row"
                :class="{
                  'wd-ovl__row--active': item.active,
                  'wd-ovl__row--passive': !item.active,
                  'wd-ovl__row--dragging': dragSlug === item.name,
                  'wd-ovl__row--drop-above':
                    dragOverSlug === item.name && dragSlug !== item.name && dropPos === 'above',
                  'wd-ovl__row--drop-below':
                    dragOverSlug === item.name && dragSlug !== item.name && dropPos === 'below',
                }"
                :data-slug="item.name"
                @click="onRowClick(<OverlaySwitchItem>(item as unknown))"
              >
                <!-- Label + actions (LEFT of icon, only when expanded) -->
                <div v-if="expanded" class="wd-ovl__row-info">
                  <span
                    v-if="editMode"
                    class="wd-ovl__drag-handle"
                    title="Drag to reorder"
                    @pointerdown.stop="onHandlePointerDown($event, item.name)"
                    @pointermove="onHandlePointerMove"
                    @pointerup="onHandlePointerUp"
                    @pointercancel="onHandlePointerUp"
                  >
                    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                      <circle cx="2" cy="3" r="1.2" />
                      <circle cx="6" cy="3" r="1.2" />
                      <circle cx="2" cy="8" r="1.2" />
                      <circle cx="6" cy="8" r="1.2" />
                      <circle cx="2" cy="13" r="1.2" />
                      <circle cx="6" cy="13" r="1.2" />
                    </svg>
                  </span>
                  <button
                    v-if="hasInfo(item.name)"
                    class="wd-ovl__row-action wd-ovl__row-action--info"
                    :aria-label="`${item.label} info`"
                    title="Info"
                    @click.stop="openConfig(item.name, 'legend')"
                  >
                    <q-icon name="wd-info" size="xs" />
                  </button>
                  <span class="wd-ovl__row-name">{{ item.label }}</span>
                  <button
                    v-if="hasFilterConfig(item.name)"
                    class="wd-ovl__row-action"
                    :class="{ 'wd-ovl__row-action--filtered': hasActiveFilters(item.name) }"
                    :aria-label="`${item.label} filter`"
                    title="Filter"
                    @click.stop="openConfig(item.name, 'filter')"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                    >
                      <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />
                    </svg>
                  </button>
                  <button
                    v-if="editMode"
                    class="wd-ovl__row-action wd-ovl__row-action--remove"
                    :aria-label="`${item.label} remove from group`"
                    title="Remove from group"
                    @click.stop="removeLayerFromGroup(item.name)"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    >
                      <path d="M5 12h14" />
                    </svg>
                  </button>
                </div>

                <!-- Icon button (ALWAYS at the right edge of the box) -->
                <span
                  class="wd-ovl__icon"
                  :class="{
                    'wd-ovl__icon--active': item.active,
                    'wd-ovl__icon--inactive': !item.active,
                    'wd-ovl__icon--pulse': toggledSlug === item.name,
                  }"
                  :aria-label="item.label"
                  role="button"
                  :aria-pressed="item.active"
                  @touchstart.passive="onSwipeStart"
                  @touchend.passive="onSwipeEnd"
                >
                  <q-icon :name="layerIcon(item.icon)" size="20px" />
                  <span
                    v-if="hasActiveFilters(item.name)"
                    class="wd-ovl__chip-filter"
                    :aria-label="`${item.label}: filter active`"
                  >
                    <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />
                    </svg>
                  </span>
                </span>
              </div>
              <!-- ONE separator under the group rows: the title sits ON the
               line; the mini box shows the line only (label hidden). -->
              <div
                v-if="visibleOthers.length > 0 || editMode"
                key="wd-ovl-sep"
                class="wd-ovl__sep"
                :class="{ 'wd-ovl__sep--drop': dropOnSep }"
                role="separator"
                :aria-label="t('overlays.other_layers')"
              >
                <span class="wd-ovl__sep-rule" />
                <span v-if="visibleOthers.length > 0" class="wd-ovl__sep-label">{{
                  t('overlays.other_layers')
                }}</span>
                <span class="wd-ovl__sep-rule" />
              </div>

              <!-- Non-group layers, ONE list: selected first, then lingering
               (6s grace), then the rest. Same row DOM in mini and expanded —
               labels just clip in the 48px mini box. -->
              <div
                v-for="item in visibleOthers"
                :key="`o-${item.name}`"
                class="wd-ovl__row"
                :class="{
                  'wd-ovl__row--active': item.active,
                  'wd-ovl__row--other': !item.active,
                  'wd-ovl__row--lingering': !item.active && lingeringSlugs.has(item.name),
                  'wd-ovl__row--dragging': dragSlug === item.name,
                }"
                :data-slug="item.name"
                @click="onRowClick(<OverlaySwitchItem>(item as unknown))"
              >
                <div v-if="expanded" class="wd-ovl__row-info">
                  <span
                    v-if="editMode"
                    class="wd-ovl__drag-handle"
                    title="Drag into the group"
                    @pointerdown.stop="onHandlePointerDown($event, item.name)"
                    @pointermove="onHandlePointerMove"
                    @pointerup="onHandlePointerUp"
                    @pointercancel="onHandlePointerUp"
                  >
                    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                      <circle cx="2" cy="3" r="1.2" />
                      <circle cx="6" cy="3" r="1.2" />
                      <circle cx="2" cy="8" r="1.2" />
                      <circle cx="6" cy="8" r="1.2" />
                      <circle cx="2" cy="13" r="1.2" />
                      <circle cx="6" cy="13" r="1.2" />
                    </svg>
                  </span>
                  <button
                    v-if="hasInfo(item.name)"
                    class="wd-ovl__row-action wd-ovl__row-action--info"
                    :aria-label="`${item.label} info`"
                    title="Info"
                    @click.stop="openConfig(item.name, 'legend')"
                  >
                    <q-icon name="wd-info" size="xs" />
                  </button>
                  <span class="wd-ovl__row-name">{{ item.label }}</span>
                  <button
                    v-if="hasFilterConfig(item.name)"
                    class="wd-ovl__row-action"
                    :class="{ 'wd-ovl__row-action--filtered': hasActiveFilters(item.name) }"
                    :aria-label="`${item.label} filter`"
                    title="Filter"
                    @click.stop="openConfig(item.name, 'filter')"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                    >
                      <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />
                    </svg>
                  </button>
                  <button
                    v-if="editMode && !isInActiveGroup(item.name)"
                    class="wd-ovl__row-action wd-ovl__row-action--add"
                    :aria-label="`${item.label} add to group`"
                    @click.stop="addLayerToGroup(item.name)"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </div>
                <span
                  class="wd-ovl__icon"
                  :class="{
                    'wd-ovl__icon--active': item.active,
                    'wd-ovl__icon--inactive': !item.active,
                    'wd-ovl__icon--pulse': toggledSlug === item.name,
                  }"
                  :aria-label="item.label"
                  role="button"
                  :aria-pressed="item.active"
                  @touchstart.passive="onSwipeStart"
                  @touchend.passive="onSwipeEnd"
                >
                  <q-icon :name="layerIcon(item.icon)" size="20px" />
                  <span
                    v-if="hasActiveFilters(item.name)"
                    class="wd-ovl__chip-filter"
                    :aria-label="`${item.label}: filter active`"
                  >
                    <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />
                    </svg>
                  </span>
                </span>
              </div>
            </TransitionGroup>
            <!-- Insertion marker: a real dashed line pinned to the target
               row's boundary — no radius, scrolls with the content. -->
            <div
              v-if="dropLineTop !== null"
              class="wd-ovl__dropline"
              :style="{ top: dropLineTop + 'px' }"
              aria-hidden="true"
            />
          </div>
          <div
            class="wd-ovl__fade wd-ovl__fade--top"
            :class="{ 'wd-ovl__fade--hidden': scrollAtTop }"
          />
          <div
            class="wd-ovl__fade wd-ovl__fade--bottom"
            :class="{ 'wd-ovl__fade--hidden': scrollAtBottom }"
          />
        </div>

        <!-- Group selector: spans the box width, distinct from layer buttons.
             ‹ icon › = cycle through groups. In edit mode it cycles ALL
             groups (hidden included). -->
        <button
          v-if="groupCycleable"
          class="wd-ovl__group-btn"
          :aria-label="t('overlays.group_switch', { name: overlayStore.activeGroupName(t) })"
          :title="t('overlays.group_switch', { name: overlayStore.activeGroupName(t) })"
          @click.stop="onGroupSelectorTap"
          @wheel.prevent
        >
          <svg
            class="wd-ovl__group-arrow wd-ovl__group-arrow--prev"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
          <Transition :name="`wd-ovl-gswap-${groupSwapDir}`" mode="out-in">
            <span :key="overlayStore.groupSettings.activeGroupId ?? 'g'" class="wd-ovl__gswap-item">
              <WdBackendIcon :slug="overlayStore.activeGroupIcon()" :size="20" />
            </span>
          </Transition>
          <svg
            class="wd-ovl__group-arrow wd-ovl__group-arrow--next"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
          <!-- Expanded: the FULL halves are hit zones — left = previous,
               right = next (divs: the outer element is already a button) -->
          <div
            v-if="expanded"
            class="wd-ovl__group-half wd-ovl__group-half--prev"
            :title="t('overlays.group_prev', { name: overlayStore.activeGroupName(t) })"
            @click.stop="onGroupStepTap(-1)"
          />
          <div
            v-if="expanded"
            class="wd-ovl__group-half wd-ovl__group-half--next"
            :title="t('overlays.group_next', { name: overlayStore.activeGroupName(t) })"
            @click.stop="onGroupStepTap(1)"
          />
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

        <!-- Edit mode: cancel (X) / confirm (✓) footer (restored — the
             header ✓ stays as the keyboard/discoverable exit). -->
        <div v-if="editMode" class="wd-ovl__more-group" @wheel.prevent>
          <button
            class="wd-ovl__more wd-ovl__more--cancel"
            :aria-label="t('overlays.edit_cancel')"
            @click.stop="cancelEdit"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <button
            class="wd-ovl__more wd-ovl__more--confirm"
            :aria-label="t('overlays.edit_done')"
            @click.stop="confirmEdit"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
        <button
          v-else
          class="wd-ovl__more"
          :aria-label="expanded ? t('close') : t('overlay_style')"
          :aria-expanded="expanded"
          @click.stop="expanded = !expanded"
        >
          <svg v-if="!expanded" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
          <svg
            v-else
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </Transition>

    <!-- ── Main toggle (48px, colored SVG icon, 360° rotation) ───────── -->
    <button
      class="wd-ovl__toggle"
      :aria-label="t('overlay_style')"
      :aria-expanded="stripOpen"
      @click="stripOpen = !stripOpen"
    >
      <img
        v-show="!stripOpen"
        :src="iconOpen"
        alt=""
        class="wd-ovl__toggle-icon wd-ovl__toggle-icon--closed-icon"
        :class="{ 'wd-ovl__toggle-icon--hidden': stripOpen }"
      />
      <img
        v-show="stripOpen"
        :src="iconClose"
        alt=""
        class="wd-ovl__toggle-icon"
        :class="{ 'wd-ovl__toggle-icon--open': stripOpen }"
      />
    </button>

    <!-- ── Floating drag ghost: the row follows the cursor ──────────── -->
    <Teleport to="body">
      <div
        v-if="dragSlug && dragPointer && draggedItem"
        class="wd-ovl__dragghost"
        :style="{ left: dragPointer.x + 'px', top: dragPointer.y + 'px' }"
        aria-hidden="true"
      >
        <span class="wd-ovl__dragghost-chip">
          <q-icon :name="layerIcon(draggedItem.icon)" size="18px" />
        </span>
        <span class="wd-ovl__dragghost-label">{{ draggedItem.label }}</span>
      </div>
    </Teleport>

    <!-- ── Group icon picker (edit mode) ──────────────────────────────── -->
    <q-dialog v-model="showIconPicker">
      <div class="wd-ovl__icon-picker">
        <div class="wd-ovl__icon-picker-title">{{ t('overlays.icon_change') }}</div>
        <q-input
          v-model="iconQuery"
          dense
          outlined
          clearable
          class="wd-ovl__icon-search"
          :placeholder="t('overlays.icon_search')"
          :loading="iconSearching"
        >
          <template #prepend><q-icon name="wd-search-outline" size="16px" /></template>
        </q-input>
        <!-- Search results (backend icon library) -->
        <template v-if="iconQuery && iconQuery.trim().length >= 2">
          <div v-if="iconSearchError" class="wd-ovl__icon-note">
            {{ t('overlays.icon_search_error') }}
          </div>
          <div v-else-if="!iconSearching && iconResults.length === 0" class="wd-ovl__icon-note">
            {{ t('overlays.icon_none') }}
          </div>
          <div v-else class="wd-ovl__icon-grid">
            <button
              v-for="choice in visibleIconResults"
              :key="choice.slug"
              class="wd-ovl__icon-cell"
              :class="{ 'wd-ovl__icon-cell--active': choice.slug === activeGroupIconName }"
              :aria-label="choice.slug"
              :title="choice.slug"
              @click.stop="applyGroupIcon(choice.slug)"
            >
              <WdBackendIcon :slug="choice.slug" :url="choice.url" :size="26" />
            </button>
            <!-- Auto lazy-load sentinel: reveals the next chunk on scroll -->
            <div
              v-if="iconVisibleCount < iconResults.length"
              ref="iconMoreSentinel"
              class="wd-ovl__icon-sentinel"
              aria-hidden="true"
            />
          </div>
        </template>
        <!-- Common set: curated Fluent Emoji (Flat) activities -->
        <template v-else>
          <div class="wd-ovl__icon-grid">
            <button
              v-for="slug in groupIconChoices"
              :key="slug"
              class="wd-ovl__icon-cell"
              :class="{ 'wd-ovl__icon-cell--active': slug === activeGroupIconName }"
              :aria-label="slug"
              :title="slug"
              @click.stop="applyGroupIcon(slug)"
            >
              <WdBackendIcon :slug="slug" :size="26" />
            </button>
          </div>
        </template>
      </div>
    </q-dialog>
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
    // NOTE: no pop animation here — re-firing a scale on every expand
    // made the rows visibly wobble (the "something moves" effect).
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
  padding: 0;
  border-radius: 4px;
  background: var(--wd-ctl-bg);
  border: 1px solid var(--wd-ctl-border);
  color: var(--wd-ctl-ink);

  // Edit mode: tapping the group icon opens the icon picker
  &--pick {
    cursor: pointer;
    transition:
      background-color 0.12s $ease,
      border-color 0.12s $ease;

    &:hover {
      background: var(--wd-ctl-hover);
    }

    &::after {
      content: '▾';
      font-size: 8px;
      line-height: 1;
      margin-left: 1px;
      opacity: 0.55;
    }
  }
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

// Title as a quick-switch DROPDOWN (expanded + edit): same look, plus a
// caret and a hover affordance
.wd-ovl__toolbar-title--menu {
  border: none;
  background: transparent;
  padding: 4px 6px 4px 0;
  margin-left: -6px;
  border-radius: 4px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.12s $ease;

  &:hover {
    background: var(--wd-ctl-hover);
  }

  .wd-ovl__toolbar-title-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .wd-ovl__toolbar-title-caret {
    flex: none;
    opacity: 0.5;
    transition:
      transform 0.15s $ease,
      opacity 0.15s $ease;
  }

  &:hover .wd-ovl__toolbar-title-caret {
    opacity: 0.85;
  }
}

.wd-ovl__toolbar-actions {
  display: flex;
  gap: 2px;
  flex: none;
  pointer-events: auto;
}

// Header action buttons are BORDERLESS icon hits — the toolbar already
// carries the box; bordered buttons inside read as boxes-in-a-box. The
// group icon keeps its bordered CHIP look (it mirrors the row icons).
.wd-ovl__toolbar-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 36px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  pointer-events: auto;
  flex: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;

  &:hover {
    background: var(--wd-ctl-hover);
    color: var(--wd-ctl-ink);
  }

  &:active {
    transform: scale(0.95);
  }

  // Edit mode: the ✓ IS the single exit — it reads as the confirm action
  &--active {
    color: #1f6b58;
    background: rgba(42, 138, 114, 0.1);

    &:hover {
      background: rgba(42, 138, 114, 0.16);
      color: #17513f;
    }
  }
}

body.body--dark .wd-ovl__toolbar-btn {
  // borderless icons sit on a dark panel — rest slightly brighter so the
  // actions stay discoverable without borders
  color: rgba(169, 240, 210, 0.75);
}

body.body--dark .wd-ovl__toolbar-btn--active {
  color: #7fe3c8;
  border-color: rgba(127, 227, 200, 0.4);
  background: rgba(127, 227, 200, 0.08);
}

// ── Scroll fades (top + bottom) ───────────────────────────────────────
// INSIDE the rows container — sticky positioned so they stay visible
// while the content scrolls. They kiss the clipped rows, not the box.
.wd-ovl__rows-wrap {
  position: relative; // anchor for the fades
  overflow: hidden; // clip fades to the rounded corners
  border-radius: 8px 8px 0 0; // mini top corners (expanded squares them)
  flex: 0 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  pointer-events: auto; // wheel/touch must not reach the map
  // Height = full mini content (group + promoted rows + separator), FIXED
  // — identical geometry in mini and expanded → every icon stays
  // pixel-perfect (a max-height lets the mini box content-shrink and drift).
  height: calc((var(--mini-rows, 4) + var(--prom-count, 0)) * 42px + 6px + var(--prom-extra, 0px));
  // Height changes when promoted rows join/leave (linger) — ease the resize
  transition: height 0.22s $ease;
}

// Edit mode: the wrap must NOT cap — the measured box cap (boxMaxH)
// governs; the list is content-driven up to that limit
.wd-ovl__box--edit .wd-ovl__rows-wrap {
  height: auto;
  max-height: none;
  transition: none;
}

.wd-ovl__box--expanded:not(.wd-ovl__box--edit) .wd-ovl__rows-wrap {
  border-radius: 0; // toolbar floats above and carries the radius
}

.wd-ovl__fade {
  // Absolute on the WRAPPER (outside the scroll container): flush with
  // the visible edges, radius-clipped. Sticky inside a padded scroller
  // always sat offset by the padding.
  position: absolute;
  left: 0;
  right: 0;
  z-index: 2;
  height: 8px;
  pointer-events: none;
  transition: opacity 0.25s $ease;

  &--top {
    top: 0;
    background: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--wd-ctl-bg) 55%, transparent),
      transparent
    );
  }

  &--bottom {
    bottom: 0;
    background: linear-gradient(
      to top,
      color-mix(in srgb, var(--wd-ctl-bg) 55%, transparent),
      transparent
    );
  }

  &--hidden {
    opacity: 0;
  }
}

// ── Rows (scrollable) ────────────────────────────────────────────────────
// FIXED height: identical in mini and expanded — the box grows UP by the
// header height when expanding, so the icon chips never move a pixel.
.wd-ovl__rows {
  pointer-events: auto; // solid panel area — wheel/touch must NOT reach the map
  position: relative;
  flex: 1 1 auto; // fill the wrap — the wrap carries the height cap
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

@media (min-width: #{$breakpoint-sm + 1}) {
  .wd-ovl__scrollthumb {
    width: 1.5px; // hairline always visible on desktop
  }
}

/* Mobile: the overlay thumb IS the scroll affordance (fades alone were
   too subtle in the expanded view) — it stays visible, slightly stronger */
@media (max-width: #{$breakpoint-sm}) {
  .wd-ovl__scrollthumb {
    width: 2.5px;
    background: rgba(128, 145, 135, 0.7);
  }
}

// Mouse pan affordance: grab cursor over the list (desktop)
@media (min-width: #{$breakpoint-sm + 1}) and (pointer: fine) {
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
  transition:
    color 0.15s $ease,
    font-weight 0.15s $ease;
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
  transition:
    background-color 0.12s $ease,
    color 0.12s $ease;

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

// Toggle feedback: a quick pulse acknowledges the flip (impeccable:
// 100–150 ms acknowledge; this is the row's authored moment)
.wd-ovl__icon--pulse {
  animation: wd-ovl-chip-pulse 0.32s $ease;
}

@keyframes wd-ovl-chip-pulse {
  0% {
    transform: scale(1);
  }

  40% {
    transform: scale(0.78);
    // Gold flash — background-color survives the dark-mode shadow kill,
    // unlike a box-shadow halo
    background-color: rgba(191, 171, 37, 0.35);
  }

  100% {
    transform: scale(1);
  }
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
  height: 30px;
  min-height: 30px;
  border: none;
  border-top: 1px solid var(--wd-ctl-border);
  background: transparent; // no tonal band against the rows above
  color: var(--wd-ctl-ink);
  cursor: pointer;
  flex: none;
  width: 100%;
  border-radius: 0 0 8px 8px;
  transition:
    background-color 0.12s $ease,
    color 0.12s $ease;
  pointer-events: auto;

  &:hover {
    background: var(--wd-ctl-hover);
  }
}

// More button: taller on mobile — the primary expand affordance needs
// a proper touch target
@media (max-width: #{$breakpoint-sm}) {
  .wd-ovl__more {
    height: 36px;
    min-height: 36px;
  }
}

// ── Group selector: spans the box width, clearly distinct ────────────────
// ‹ icon › — the flanking chevrons read as "cycle", not "expand"
.wd-ovl__group-btn {
  position: relative; // anchor for the half hit zones
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  align-self: stretch;
  height: 34px;
  padding: 0 6px;
  border: none;
  border-top: 1px solid var(--wd-ctl-border);
  // NO bottom radius here — the expand bar follows below in mini/expanded;
  // rounding mid-box shows tonal corners. The button rounds only when it
  // is the box's last element (edit mode has no footer).
  border-radius: 0;
  background: var(--wd-ctl-date-bg);
  color: var(--wd-ctl-ink);
  cursor: pointer;
  flex: none;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.12s $ease;

  &:hover {
    background: var(--wd-ctl-hover);

    .wd-ovl__group-arrow--prev {
      transform: translateX(-1.5px);
    }

    .wd-ovl__group-arrow--next {
      transform: translateX(1.5px);
    }
  }

  &:active {
    background: var(--wd-ctl-active-bg);
    transform: scaleY(0.97);
  }

  .wd-ovl__group-arrow {
    opacity: 0.7;
    flex: none;
    color: var(--wd-ctl-ink-soft);
    transition:
      transform 0.15s $ease,
      opacity 0.15s $ease;
  }
}

// Group icon swap on cycle: quiet vertical slide
// Expanded: the FULL halves of the group button are hit zones —
// left = previous, right = next. The visuals sit above but are
// pointer-inert, so every click lands on a half.
.wd-ovl__group-half {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  cursor: pointer;
  z-index: 0;
  transition: background-color 0.12s $ease;

  &--prev {
    left: 0;
    border-radius: 0;
  }

  &--next {
    right: 0;
  }

  &:hover {
    background: var(--wd-ctl-hover);
  }
}

.wd-ovl__box--expanded .wd-ovl__group-btn > svg,
.wd-ovl__box--expanded .wd-ovl__group-btn > .wd-ovl__gswap-item {
  pointer-events: none;
  position: relative;
  z-index: 1;
}

// Horizontal, direction-aware: 'next' pushes left, 'previous' pushes right
.wd-ovl-gswap-fwd-enter-active,
.wd-ovl-gswap-fwd-leave-active,
.wd-ovl-gswap-back-enter-active,
.wd-ovl-gswap-back-leave-active {
  transition:
    opacity 0.16s $ease,
    transform 0.16s $ease;
}

.wd-ovl-gswap-fwd-enter-from {
  opacity: 0;
  transform: translateX(14px);
}

.wd-ovl-gswap-fwd-leave-to {
  opacity: 0;
  transform: translateX(-14px);
}

.wd-ovl-gswap-back-enter-from {
  opacity: 0;
  transform: translateX(-14px);
}

.wd-ovl-gswap-back-leave-to {
  opacity: 0;
  transform: translateX(14px);
}

// ── ONE separator under the group rows ─────────────────────────
// Compact: the title sits ON the line (rule — label — rule). The mini box
// shows the line only — the label is hidden below 48px width.
.wd-ovl__sep {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: none;
  min-height: 14px;
  margin: 2px 8px 2px;
  pointer-events: auto; // drop target in edit mode (opt back in)
  transition:
    background-color 0.12s $ease,
    box-shadow 0.12s $ease;
}

.wd-ovl__sep-rule {
  flex: 1;
  height: 1px;
  min-width: 4px;
  border-radius: 1px;
  background: linear-gradient(
    to right,
    transparent,
    var(--wd-ctl-border) 18%,
    var(--wd-ctl-border) 82%,
    transparent
  );
}

.wd-ovl__sep-label {
  flex: none;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9.5px;
  font-weight: 600;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--wd-ctl-ink);
  opacity: 0.6;
}

// Mini view: line only — no title
.wd-ovl__box:not(.wd-ovl__box--expanded) .wd-ovl__sep {
  gap: 0;
  margin: 2px 4px 2px; // same vertical footprint as expanded (pixel-perfect)
}

.wd-ovl__box:not(.wd-ovl__box--expanded) .wd-ovl__sep-label {
  display: none;
}

// Drop zone while dragging (edit mode): ungroup the dragged layer —
// dashed ring, same marker language as the insertion line
.wd-ovl__sep--drop {
  background: color-mix(in srgb, var(--wd-gold-text, #846a15) 7%, transparent);
  border-radius: 4px;
  outline: 1px dashed color-mix(in srgb, var(--wd-gold-text, #846a15) 65%, transparent);
  outline-offset: -1px;
  cursor: alias;
}

// ── Row list transitions (FLIP): reorder, linger enter/leave ──────────
.wd-ovl-row-move {
  transition: transform 0.25s $ease;
}

.wd-ovl-row-enter-active {
  transition:
    opacity 0.2s $ease,
    transform 0.2s $ease;
}

.wd-ovl-row-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.wd-ovl-row-leave-active {
  // Pull out of flow so siblings slide up smoothly underneath
  position: absolute;
  left: 3px;
  right: 3px;
  transition:
    opacity 0.22s $ease,
    transform 0.22s $ease;
}

.wd-ovl-row-leave-to {
  opacity: 0;
  transform: translateX(10px) scale(0.98);
}

// Lingering rows (switched off, inside the 6s grace window): settle quietly
.wd-ovl__row--lingering {
  .wd-ovl__icon {
    opacity: 0.4;
  }
}

// Row currently dragged (edit mode): quiet ghost, slightly contracted
.wd-ovl__row--dragging {
  opacity: 0.4;
  transform: scale(0.985);
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

  // Toolbar becomes an IN-FLOW header (the maximized box has room)
  .wd-ovl__toolbar {
    position: static;
    flex: none;
    border: none;
    border-bottom: 1px solid var(--wd-ctl-border);
    border-radius: 8px 8px 0 0;
  }

  // Rows fill the remaining space
  .wd-ovl__rows {
    max-height: none !important;
    flex: 1 1 auto;
    min-height: 120px;
  }
}

// ── Row actions (edit mode): add/remove from group ────────────────────
.wd-ovl__row-action--remove {
  color: #c44e3b;
  &:hover {
    background: rgba(196, 78, 59, 0.08);
  }
}

.wd-ovl__row-action--add {
  color: #2a8a72;
  &:hover {
    background: rgba(42, 138, 114, 0.08);
  }
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
  transition:
    opacity 0.12s $ease,
    color 0.12s $ease;

  &:hover {
    opacity: 0.85;
    color: var(--wd-ctl-ink);
  }
}

// ── Drop marker: dashed insertion line + soft landing tint ────────────
// The LINE is a real element (.wd-ovl__dropline in the template) — no
// radius, no border trickery. Deep readable gold (theme token) so the
// marker stays crisp on the bright panel. The row classes carry the tint.
.wd-ovl__row--drop-above,
.wd-ovl__row--drop-below {
  background: rgba(191, 171, 37, 0.08);
}

.wd-ovl__dropline {
  position: absolute;
  left: 7px;
  right: 7px;
  height: 0;
  border-top: 2px dashed var(--wd-gold-text, #846a15);
  pointer-events: none;
  z-index: 4;
  transform-origin: left center;
  animation: wd-ovl-dropline-in 0.14s $ease;
}

@keyframes wd-ovl-dropline-in {
  from {
    opacity: 0;
    transform: scaleX(0.55);
  }

  to {
    opacity: 1;
    transform: scaleX(1);
  }
}

// ── Other rows: passive dimming (active rows stay full) ──────────────
.wd-ovl__row--other {
  .wd-ovl__row-name {
    opacity: 0.6;
  }
  .wd-ovl__icon {
    opacity: 0.7;
  }
}

// ── Floating drag ghost ─────────────────────────────────────────────────
.wd-ovl__dragghost {
  position: fixed;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 4px;
  border: 1px solid var(--wd-ctl-border);
  border-radius: 4px;
  background: var(--wd-ctl-bg);
  box-shadow:
    0 8px 22px rgba(10, 20, 15, 0.26),
    0 2px 5px rgba(10, 20, 15, 0.16) !important;
  pointer-events: none;
  z-index: 2100;
  // Hover just above the pointer — the insertion line stays visible
  transform: translate(-50%, calc(-50% - 16px));
  animation: wd-ovl-ghost-in 0.12s $ease;
}

.wd-ovl__dragghost-chip {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid var(--wd-ctl-border);
  background: var(--wd-ctl-date-bg);
}

.wd-ovl__dragghost-label {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--wd-ctl-ink);
  white-space: nowrap;
}

@keyframes wd-ovl-ghost-in {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% - 10px)) scale(0.88);
  }

  to {
    opacity: 1;
    transform: translate(-50%, calc(-50% - 16px)) scale(1);
  }
}

// Header buttons: the ✓ (edit exit) is the ONLY tinted action — the +
// and ⋮ stay neutral so the confirm reads unambiguous. The crossed eye
// (group hidden) carries the gold status color.
.wd-ovl__toolbar-btn--warn {
  color: #8a7a1e;

  &:hover {
    color: #6d5f14;
  }
}

body.body--dark .wd-ovl__toolbar-btn--warn {
  color: $wd-gold-bright;
}

.wd-ovl__toolbar-btn--add {
  color: var(--wd-ctl-ink-soft);
}

body.body--dark .wd-ovl__toolbar-btn--add {
  color: inherit;
}

// ── Empty-group hint (edit mode, no layers in the group yet) ───────────
.wd-ovl__empty-hint {
  flex: none;
  padding: 10px 10px 6px;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--wd-ctl-ink-soft);
  opacity: 0.85;
}

body.body--dark .wd-ovl__empty-hint {
  color: #9fc3b2;
}

.wd-ovl__icon-picker-title {
  font-family: 'Barlow Semi Condensed', 'Barlow', sans-serif;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--wd-ctl-ink);
  margin-bottom: 12px;
}

.wd-ovl__icon-sentinel {
  grid-column: 1 / -1;
  height: 2px;
}

.wd-ovl__icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 6px;
  max-height: 50dvh;
  overflow-y: auto;
}

.wd-ovl__icon-cell {
  display: grid;
  place-items: center;
  height: 48px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.12s $ease,
    border-color 0.12s $ease;

  &:hover {
    background: var(--wd-ctl-hover);
  }

  &--active {
    border-color: var(--wd-ctl-ring);
    background: var(--wd-ctl-date-bg);
  }
}

// ── Footer: cancel (X) + confirm (✓) on ONE line ──────────────────────
// ── Footer: cancel (X) + confirm (✓) on ONE line (edit mode) ──────────
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

  &:hover {
    background: var(--wd-ctl-hover);
  }
}

.wd-ovl__more-group .wd-ovl__more--confirm {
  border-bottom-right-radius: 8px;
  color: #2a8a72;
  background: rgba(42, 138, 114, 0.07);

  &:hover {
    background: rgba(42, 138, 114, 0.14);
  }
}

// ── Reduced motion: keep state legible, drop spatial movement ─────────
@media (prefers-reduced-motion: reduce) {
  .wd-ovl__rows-wrap,
  .wd-ovl__box {
    transition: none;
  }

  .wd-ovl-row-enter-active,
  .wd-ovl-row-leave-active,
  .wd-ovl-row-move {
    transition: opacity 0.12s linear;
    transform: none;
  }

  .wd-ovl-gswap-enter-active,
  .wd-ovl-gswap-leave-active {
    transition: opacity 0.12s linear;
    transform: none;
  }

  .wd-ovl__dropline,
  .wd-ovl__icon--pulse {
    animation: none;
  }
}
</style>

<style lang="scss">
/* q-menu / q-dialog TELEPORT to <body> — scoped selectors never match.
   These panels need global styles. */
// ── 3-dot menu (header): opaque quiet panel ───────────────────────────
.wd-ovl__menu {
  background: var(--wd-ctl-bg) !important; // opaque panel — never transparent
  border: 1px solid var(--wd-ctl-border);
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(10, 20, 15, 0.18) !important; // dark-mode elevation kill escape
  padding: 4px;

  .q-item {
    min-height: 38px;
    font-size: 13.5px;
    color: var(--wd-ctl-ink);
    border-radius: 4px;
  }

  .q-item__section--avatar {
    min-width: 26px;
    color: var(--wd-ctl-ink-soft);
  }
}

body.body--dark .wd-ovl__menu .q-item {
  color: #cfe8dc;
}

/* Icon picker search (dialog teleports to body) */
.wd-ovl__icon-search {
  margin-bottom: 12px;
}

.wd-ovl__icon-note {
  padding: 14px 4px;
  font-size: 12.5px;
  color: var(--wd-ctl-ink-soft);
}

/* Group quick-switch dropdown (title): active item + hidden marker */
.wd-ovl__group-menu .q-item__section--avatar .q-icon img,
.wd-ovl__group-menu .q-item__section--avatar img {
  border-radius: 2px;
}

.wd-ovl__group-menu-item--active {
  font-weight: 600;
  background: var(--wd-ctl-hover);

  .q-item__section--avatar {
    color: var(--wd-ctl-ink);
  }
}

.wd-ovl__group-menu .q-item__section--side {
  color: var(--wd-ctl-ink-soft);
  opacity: 0.7;
}

.wd-ovl__menu-item--danger {
  color: #c44e3b !important;

  .q-item__section--avatar {
    color: #c44e3b;
  }
}

// ── Group icon picker dialog ─────────────────────────────────────────────
.wd-ovl__icon-picker {
  padding: 16px;
  max-width: 320px;
  background: var(--wd-ctl-bg) !important; // opaque panel
  border: 1px solid var(--wd-ctl-border);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(10, 20, 15, 0.24) !important;
}
</style>
