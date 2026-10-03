import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { OverlaySwitchItem } from '@stores/map/utils/interfaces';
import { overlayFactories } from '@stores/map/utils/overlays';
import {
  getActiveGroup,
  getVisibleGroups,
  getGroupLayers,
  getOtherLayers,
  cycleGroup as cycleGroupUtil,
  groupDisplayName,
  defaultOverlayGroupSettings,
  mergeGroups,
  type LayerGroup,
  type OverlayGroupSettings,
} from '@stores/map/utils/layer-groups';
import { useUserSettingsStore } from '@stores/user-settings-store';
//import { useMap } from '@indoorequal/vue-maplibre-gl';
//import type { Emitter } from 'mitt';
import { LocalStorage } from 'quasar';

export const useOverlayStore = defineStore('overlay', () => {
  function toggleOverlay(s: OverlaySwitchItem): boolean {
    s.active = s.active ? false : true;
    LocalStorage.set('overlays', overlays);
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

  const savedOverlays: Array<OverlaySwitchItem> = LocalStorage.hasItem('overlays')
    ? (LocalStorage.getItem('overlays') as Array<OverlaySwitchItem>)
    : [];
  const savedOverlaysRecord = savedOverlays.reduce(
    (acc: Record<string, OverlaySwitchItem>, obj: OverlaySwitchItem) => {
      acc[obj.name] = obj;
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
  const settingsStore = useUserSettingsStore() as unknown as { settings: { map: Record<string, unknown> }, updateMapSetting: (k: string, v: unknown) => void };
  const groupSettings = reactive<OverlayGroupSettings>(
    (settingsStore.settings.map as Record<string, unknown>).overlayGroups as OverlayGroupSettings
      ?? defaultOverlayGroupSettings()
  );

  // Keep the settings store in sync
  function syncGroupSettings(): void {
    (settingsStore.settings.map as Record<string, unknown>).overlayGroups = groupSettings;
    settingsStore.updateMapSetting('overlayGroups', groupSettings);
  }

  /** Layers of the active group (for the mini strip) */
  function activeGroupLayers(): OverlaySwitchItem[] {
    const group = getActiveGroup(groupSettings);
    const list = overlays as unknown as Array<{ name: string; show?: boolean; active?: boolean }>;
    if (!group) return (overlays as unknown as OverlaySwitchItem[]).filter(o => o.show);
    return getGroupLayers(group, list as unknown as OverlaySwitchItem[]);
  }

  /** All layers NOT in the active group (for the expanded "All layers" section) */
  function otherLayers(): OverlaySwitchItem[] {
    const group = getActiveGroup(groupSettings);
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
      const flat = overlays as unknown as Array<{ name: string; active?: boolean }>;
      currentGroup.activeLayerSlugs = flat
        .filter(o => o.active)
        .map(o => o.name);
    }

    groupSettings.activeGroupId = group.id;
    for (const o of overlays) {
      o.active = group.activeLayerSlugs.includes(o.name);
    }
    LocalStorage.set('overlays', overlays);
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
    const allSlugs = (overlays as unknown as Array<{ name: string }>).map(o => o.name);
    Object.assign(groupSettings, mergeGroups(groupSettings, allSlugs));
    syncGroupSettings();
  }

  return {
    overlays,
    toggleOverlay,
    setActiveGroup,
    rebuildOverlays,
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
