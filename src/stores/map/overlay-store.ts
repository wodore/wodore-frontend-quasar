import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import { OverlaySwitchItem } from '@stores/map/utils/interfaces';
import { overlayFactories } from '@stores/map/utils/overlays';
import { mergeSwitchItems } from '@stores/map/utils/catalog-mapping';
import {
  getActiveGroup,
  getVisibleGroups,
  getGroupLayers,
  getOtherLayers,
  cycleGroup as cycleGroupUtil,
  groupDisplayName,
  defaultOverlayGroupSettings,
  mergeGroups,
  RENAMED_SLUGS,
  type LayerGroup,
  type OverlayGroupSettings,
} from '@stores/map/utils/layer-groups';
import { useUserSettingsStore } from '@stores/user-settings-store';
//import { useMap } from '@indoorequal/vue-maplibre-gl';
//import type { Emitter } from 'mitt';
import { storageGet, storageSet, storageHas } from '@services/storage';

export const useOverlayStore = defineStore('overlay', () => {
  function toggleOverlay(s: OverlaySwitchItem): boolean {
    s.active = s.active ? false : true;
    storageSet('overlays', overlays);
    // Per-group VIEW state: every toggle — member OR promoted row — records
    // into the ACTIVE group's activeLayerSlugs (= the layers active in this
    // group's view). Other groups keep their own view untouched, so a
    // promoted layer toggled here survives the round trip back.
    const active = groupSettings.groups.find(
      g => g.id === groupSettings.activeGroupId && !g.removed
    );
    if (active) {
      const has = active.activeLayerSlugs.includes(s.name);
      if (s.active && !has) active.activeLayerSlugs.push(s.name);
      else if (!s.active && has) {
        active.activeLayerSlugs = active.activeLayerSlugs.filter(x => x !== s.name);
      }
      syncGroupSettings();
    }
    return s.active;
  }
  const overlays = reactive<Array<OverlaySwitchItem>>(overlayFactories.map(factory => factory()));

  // ── Catalog swap epoch ────────────────────────────────────────────────────
  // Bumped whenever the overlay items are replaced from the backend map
  // catalog (map-catalog-store): renderers watch it to drop stale factory
  // layers/sources and re-add the catalog ones (WdOverlayControl), or to
  // recompose the native style (WdNativeMapView). Parameter-only changes
  // bump `parametersEpoch` instead (paint re-resolution, no re-add).
  const overlaysEpoch = ref(0);
  const parametersEpoch = ref(0);

  /**
   * Replace the overlay list with catalog-compiled items (map-catalog-store
   * owns the fetching): catalog items replace same-slug factory entries and
   * append; factory entries the catalog does not serve stay (transition
   * crutch until the seed reaches parity). The CURRENT active/show state
   * survives the swap; group settings re-merge so new slugs join groups.
   */
  function applyCatalogOverlays(catalogItems: OverlaySwitchItem[]): void {
    // SAFETY: overlays is the reactive OverlaySwitchItem[] below; the
    // widened cast breaks the maplibre-style TS2589 recursion (same
    // pattern as activeGroupLayers) — items are OverlaySwitchItem.
    const state = new Map(
      (overlays as unknown as OverlaySwitchItem[]).map(o => [
        o.name,
        { active: o.active, show: o.show },
      ])
    );
    const merged = mergeSwitchItems(
      overlayFactories.map(factory => factory()),
      catalogItems
    );
    // SAFETY: `overlays` is the reactive OverlaySwitchItem[] declared above;
    // splice keeps the array identity (component references stay valid) —
    // the cast breaks the same TS2589 recursion the other widened casts in
    // this file work around.
    (overlays as unknown as OverlaySwitchItem[]).splice(
      0,
      overlays.length,
      ...(merged as OverlaySwitchItem[])
    );
    // SAFETY: same widened cast as above — reading/writing active/show,
    // fields every factory and catalog item sets.
    for (const o of overlays as unknown as OverlaySwitchItem[]) {
      const s = state.get(o.name);
      if (s) {
        o.active = s.active;
        o.show = s.show;
      }
    }
    mergeLayerGroups();
    overlaysEpoch.value += 1;
  }

  const savedOverlays: Array<OverlaySwitchItem> = storageHas('overlays')
    ? (storageGet('overlays') as Array<OverlaySwitchItem>)
    : [];
  const savedOverlaysRecord = savedOverlays.reduce(
    (acc: Record<string, OverlaySwitchItem>, obj: OverlaySwitchItem) => {
      acc[obj.name] = obj;
      // Overlay renamed by an app update (RENAMED_SLUGS, e.g. the Swiss
      // raster hiking overlay → global 'hiking'): carry the persisted
      // active/show state over to the new name — unless a record under
      // the new name already exists.
      const renamedTo = RENAMED_SLUGS[obj.name];
      if (renamedTo && !(renamedTo in acc)) acc[renamedTo] = obj;
      return acc;
    },
    {}
  );

  const applySavedOverlayState = () => {
    for (const o of overlays) {
      const name = o.name;
      if (name in savedOverlaysRecord) {
        o.active = savedOverlaysRecord[name].active;
        o.show = savedOverlaysRecord[name].show;
      }
    }
  };
  applySavedOverlayState();

  /**
   * Rebuild all overlays from their factories with the ACTIVE locale
   * (labels, legends, category names are resolved at build time) while
   * preserving the user's current active/show state. Called when the UI
   * language changes.
   */
  function rebuildOverlays(): void {
    // Factories are listed in the same order as the store array (1:1 — a
    // new overlay requires a page load until this gains an append path,
    // because pushing onto the reactive array trips TS2589 with the
    // maplibre-heavy OverlaySwitchItem type). In-place Object.assign keeps
    // the reactive item identity stable (references held by components stay
    // valid) and avoids the deep type instantiation of array spread/push.
    const rebuilt = overlayFactories.map(factory => factory());
    const count = Math.min(overlays.length, rebuilt.length);
    for (let i = 0; i < count; i++) {
      const { active, show } = overlays[i];
      Object.assign(overlays[i], rebuilt[i]);
      overlays[i].active = active;
      overlays[i].show = show;
    }
  }

  // ── Layer groups ──────────────────────────────────────────────────────
  // SAFETY: the user-settings store exposes its map settings as a JSON
  // blob; the structural cast narrows the two members this store uses.
  const settingsStore = useUserSettingsStore() as unknown as {
    settings: { map: Record<string, unknown> };
    updateMapSetting: (k: string, v: unknown) => void;
  };
  const groupSettings = reactive<OverlayGroupSettings>(
    ((settingsStore.settings.map as Record<string, unknown>)
      .overlayGroups as OverlayGroupSettings) ?? defaultOverlayGroupSettings()
  );

  // Keep the settings store in sync
  function syncGroupSettings(): void {
    (settingsStore.settings.map as Record<string, unknown>).overlayGroups = groupSettings;
    settingsStore.updateMapSetting('overlayGroups', groupSettings);
  }

  /** Layers of the active group (for the mini strip) */
  function activeGroupLayers(): OverlaySwitchItem[] {
    const group = getActiveGroup(groupSettings);
    // SAFETY: overlays is Array<OverlaySwitchItem>; the widened casts
    // break the reactive-array type recursion (TS2589) that maplibre's
    // style types trigger — same pattern as WdOverlayControl.
    const list = overlays as unknown as Array<{ name: string; show?: boolean; active?: boolean }>;
    if (!group) {
      // SAFETY: same TS2589 cast as `list` above — the reactive array IS
      // OverlaySwitchItem[], only the inferred type is too deep.
      const shown = overlays as unknown as OverlaySwitchItem[];
      return shown.filter(o => o.show);
    }
    // SAFETY: `list` items are OverlaySwitchItem (see cast above).
    return getGroupLayers(group, list as unknown as OverlaySwitchItem[]);
  }

  /** All layers NOT in the active group (for the expanded "All layers" section) */
  function otherLayers(): OverlaySwitchItem[] {
    const group = getActiveGroup(groupSettings);
    // SAFETY: same TS2589 recursion break as activeGroupLayers above.
    return getOtherLayers(group, overlays as unknown as OverlaySwitchItem[]);
  }

  /** Shared switch core: reconcile the current group's active view, then
   *  activate the target and apply ITS full view — members AND promoted
   *  layers. Every overlay flag is set from the target's list: layers the
   *  target's view doesn't include turn off, ones it includes turn on
   *  (promoted layers round-trip correctly). */
  function switchToGroup(group: LayerGroup): void {
    const currentGroup = getActiveGroup(groupSettings);
    if (currentGroup && currentGroup.id !== group.id) {
      // cast: reactive array + filter explodes TS instantiation depth
      // SAFETY: each item is an OverlaySwitchItem; reading .active/.name
      // only — fields every factory sets.
      const flat = overlays as unknown as Array<{ name: string; active?: boolean }>;
      currentGroup.activeLayerSlugs = flat.filter(o => o.active).map(o => o.name);
    }

    groupSettings.activeGroupId = group.id;
    for (const o of overlays) {
      o.active = group.activeLayerSlugs.includes(o.name);
    }
    storageSet('overlays', overlays);
    syncGroupSettings();
  }

  /** Cycle to the next visible group and restore its active layers */
  function cycleGroup(includeHidden = false): void {
    const { group, settings } = cycleGroupUtil(groupSettings, includeHidden);
    if (!group) return;
    // cycleGroupUtil returns patched settings (next activeGroupId) — apply
    // them, then run the shared save/apply core.
    Object.assign(groupSettings, settings);
    switchToGroup(group);
  }

  /** Step by N through the visible groups (expanded view: ‹ previous,
   *  › next). Step −1 walks backwards; wraps around like cycleGroup. */
  function stepGroup(step: number, includeHidden = false): void {
    const visible = getVisibleGroups(groupSettings, includeHidden);
    if (visible.length === 0) return;
    const idx = visible.findIndex(g => g.id === groupSettings.activeGroupId);
    const next = visible[(idx + step + visible.length * 2) % visible.length];
    if (!next || next.id === groupSettings.activeGroupId) return;
    switchToGroup(next);
  }

  /** Switch DIRECTLY to a group (title dropdown) — same semantics as
   *  cycling: save current, activate target, apply its layer states. */
  function setActiveGroup(groupId: string, includeHidden = false): void {
    const group = groupSettings.groups.find(
      g => g.id === groupId && !g.removed && (includeHidden || !g.hidden)
    );
    if (!group || group.id === groupSettings.activeGroupId) return;
    switchToGroup(group);
  }

  /** Get the active group's display name */
  function activeGroupName(t: (key: string) => string): string {
    const group = getActiveGroup(groupSettings);
    return group ? groupDisplayName(group.name, t) : t('overlay_style');
  }

  /** Get the active group's icon slug */
  function activeGroupIcon(): string {
    const group = getActiveGroup(groupSettings);
    return group?.icon ?? 'hiking';
  }

  /** All visible groups for the selector */
  function visibleGroups(): LayerGroup[] {
    return getVisibleGroups(groupSettings);
  }

  /** Merge groups when the layer list changes */
  function mergeLayerGroups(): void {
    // SAFETY: overlays items are OverlaySwitchItem — reading .name only,
    // a field every factory sets; the cast breaks the TS2589 recursion.
    const allSlugs = (overlays as unknown as Array<{ name: string }>).map(o => o.name);
    Object.assign(groupSettings, mergeGroups(groupSettings, allSlugs));
    syncGroupSettings();
  }

  // Run the merge ONCE at store setup: rewrites overlay slugs renamed by
  // app updates (RENAMED_SLUGS — e.g. swiss raster hiking → global
  // 'hiking') in the persisted group settings, and adds predefined
  // groups the user doesn't have yet. Without this, a renamed overlay
  // drops out of every group and lands in "All layers".
  mergeLayerGroups();

  return {
    overlays,
    toggleOverlay,
    setActiveGroup,
    stepGroup,
    rebuildOverlays,
    applyCatalogOverlays,
    overlaysEpoch,
    parametersEpoch,
    // Layer groups
    groupSettings,
    activeGroupLayers,
    otherLayers,
    cycleGroup,
    activeGroupName,
    activeGroupIcon,
    visibleGroups,
    mergeLayerGroups,
    syncGroupSettings,
    //setBasemap,
    //getBasemap,
    //setEmitter,
  };
});
