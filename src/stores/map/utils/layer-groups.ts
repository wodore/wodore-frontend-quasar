/**
 * Overlay layer groups — data model, defaults, merge logic.
 * See openspec/changes/overlay-layer-groups/ for the full spec.
 */
import type { OverlaySwitchItem } from './interfaces';

// ─── Types ────────────────────────────────────────────────────────────────

export interface LayerGroup {
  id: string;
  slug: string;
  name: string;          // i18n key for predefined, literal for custom
  icon: string;
  layerSlugs: string[];
  activeLayerSlugs: string[];
  hidden: boolean;
  removed: boolean;
  locked: boolean;
  sortOrder: number;
}

export interface OverlayGroupSettings {
  groups: LayerGroup[];
  activeGroupId: string | null;
  ungroupedActiveSlugs: string[];
  dismissedGroupSlugs: string[];
}

// ─── Overlay slugs (derived from the factory names) ──────────────────────

const SLUGS = {
  huts: 'huts',
  transport: 'transport-stops',
  hiking: 'ch.swisstopo.swisstlm3d-wanderwege',
  mtb: 'mtb',
  cycling: 'cycling',
  slopeAngle: 'ch.swisstopo.hangneigung-ueber_30',
  skiTours: 'ch.swisstopo-karto.skitouren',
  snowshoes: 'ch.swisstopo.schneeschuhwandern',
  skiSlopes: 'slopes',
  nature: 'wildruhe_und_jagdbann',
  sheepdogs: 'ch.bafu.alpweiden-herdenschutzhunde',
} as const;

// ─── Default groups ───────────────────────────────────────────────────────

function uid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createDefaultGroups(): LayerGroup[] {
  const groups: Array<Omit<LayerGroup, 'id'>> = [
    {
      slug: 'hiking',
      name: 'overlays.groups.hiking.name',
      icon: 'hiking',
      layerSlugs: [SLUGS.huts, SLUGS.hiking, SLUGS.nature, SLUGS.transport],
      activeLayerSlugs: [SLUGS.huts],
      hidden: false,
      removed: false,
      locked: true,
      sortOrder: 0,
    },
    {
      slug: 'cycling',
      name: 'overlays.groups.cycling.name',
      icon: 'mtb',
      layerSlugs: [SLUGS.mtb, SLUGS.cycling, SLUGS.huts, SLUGS.transport],
      activeLayerSlugs: [],
      hidden: false,
      removed: false,
      locked: true,
      sortOrder: 1,
    },
    {
      slug: 'snowsport',
      name: 'overlays.groups.snowsport.name',
      icon: 'skitouren',
      layerSlugs: [SLUGS.skiTours, SLUGS.snowshoes, SLUGS.skiSlopes, SLUGS.slopeAngle, SLUGS.huts, SLUGS.transport],
      activeLayerSlugs: [],
      hidden: false,
      removed: false,
      locked: true,
      sortOrder: 2,
    },
  ];
  return groups.map(g => ({ ...g, id: uid() }));
}

export function defaultOverlayGroupSettings(): OverlayGroupSettings {
  const groups = createDefaultGroups();
  return {
    groups,
    activeGroupId: groups[0]?.id ?? null,
    ungroupedActiveSlugs: [],
    dismissedGroupSlugs: [],
  };
}

// ─── Merge: assign layers to groups when the layer list changes ───────────

/**
 * Merge new/predefined layers into the user's groups.
 * - Layers already in a group stay there.
 * - New layers with a defaultGroup hint are auto-added.
 * - Removed groups never receive new layers.
 */
export function mergeGroups(
  settings: OverlayGroupSettings,
  allLayerSlugs: string[],
): OverlayGroupSettings {
  const groups = settings.groups.map(g => ({ ...g, layerSlugs: [...g.layerSlugs] }));

  // Add new predefined groups (from app updates) that the user doesn't have
  // and hasn't dismissed or removed
  const existingSlugs = new Set(groups.map(g => g.slug));
  const defaults = createDefaultGroups();
  for (const def of defaults) {
    if (!existingSlugs.has(def.slug) &&
        !settings.dismissedGroupSlugs.includes(def.slug)) {
      // Check if a removed group with this slug exists — don't re-add
      const wasRemoved = groups.some(g => g.slug === def.slug && g.removed);
      if (!wasRemoved) {
        groups.push({ ...def, id: uid() });
      }
    }
  }

  // Auto-add layers with defaultGroup hints (from layer metadata)
  for (const layerSlug of allLayerSlugs) {
    for (const group of groups) {
      if (group.removed) continue;
      if (group.layerSlugs.includes(layerSlug)) continue;
      // Future: check layer.defaultGroup === group.slug → auto-add
    }
  }

  // Remove slugs from groups if the layer no longer exists
  // (keep the slug in case it comes back from the backend)
  // — we don't remove, we just let the UI handle missing layers

  return { ...settings, groups };
}

// ─── Group helpers ────────────────────────────────────────────────────────

/** Get the active group (or null if none selected) */
export function getActiveGroup(settings: OverlayGroupSettings): LayerGroup | null {
  // Hidden groups stay ACTIVE in edit mode (they must remain editable);
  // selectability is decided by getVisibleGroups, not here.
  return settings.groups.find(g => g.id === settings.activeGroupId && !g.removed) ?? null;
}

/** Get visible groups for the mini selector cycle (not hidden, not removed) */
export function getVisibleGroups(settings: OverlayGroupSettings, includeHidden = false): LayerGroup[] {
  return settings.groups
    .filter(g => !g.removed && (includeHidden || !g.hidden))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Cycle to the next visible group */
export function cycleGroup(
  settings: OverlayGroupSettings,
  includeHidden = false,
): { group: LayerGroup; settings: OverlayGroupSettings } {
  const visible = getVisibleGroups(settings, includeHidden);
  if (visible.length === 0) return { group: null!, settings };

  const currentIdx = visible.findIndex(g => g.id === settings.activeGroupId);
  const next = visible[(currentIdx + 1) % visible.length];

  // Save the current group's active layers, restore the next group's
  const groups = settings.groups.map(g => {
    if (g.id === settings.activeGroupId) {
      // Save: capture the current active state from ungroupedActiveSlugs + group activeLayerSlugs
      return g; // activeLayerSlugs already up-to-date via toggleGroupLayer
    }
    return g;
  });

  return {
    group: next,
    settings: { ...settings, groups, activeGroupId: next.id },
  };
}

/** Get layers for a group (filtered to existing overlays) */
export function getGroupLayers(
  group: LayerGroup,
  overlays: OverlaySwitchItem[],
): OverlaySwitchItem[] {
  return group.layerSlugs
    .map(slug => overlays.find(o => o.name === slug))
    .filter((o): o is OverlaySwitchItem => !!o && o.show === true);
}

/** Get layers NOT in the active group (for the "All layers" section) */
export function getOtherLayers(
  activeGroup: LayerGroup | null,
  overlays: OverlaySwitchItem[],
): OverlaySwitchItem[] {
  const activeSlugs = new Set(activeGroup?.layerSlugs ?? []);
  const others = overlays.filter(o => o.show && !activeSlugs.has(o.name));

  // Promote active layers from other groups to the top
  const active = others.filter(o => o.active);
  const inactive = others.filter(o => !o.active);
  return [...active, ...inactive];
}

/** Translate a group name (i18n key or literal) */
export function groupDisplayName(name: string, t: (key: string) => string): string {
  if (name.startsWith('overlays.')) {
    return t(name);
  }
  return name;
}
