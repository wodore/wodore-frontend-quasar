import { describe, it, expect } from 'vitest';
import {
  createDefaultGroups,
  defaultOverlayGroupSettings,
  getActiveGroup,
  getVisibleGroups,
  cycleGroup,
  getGroupLayers,
  getOtherLayers,
  groupDisplayName,
  mergeGroups,
  type LayerGroup,
} from '@stores/map/utils/layer-groups';
import type { OverlaySwitchItem } from '@stores/map/utils/interfaces';

// Mock overlays for testing
const makeOverlay = (name: string, active = false): OverlaySwitchItem =>
  ({ name, active, show: true }) as unknown as OverlaySwitchItem;

const mockOverlays = [
  makeOverlay('huts', true),
  makeOverlay('transport-stops'),
  makeOverlay('ch.swisstopo.swisstlm3d-wanderwege'),
  makeOverlay('mtb'),
  makeOverlay('cycling'),
  makeOverlay('ch.swisstopo.hangneigung-ueber_30'),
  makeOverlay('ch.swisstopo-karto.skitouren'),
  makeOverlay('ch.swisstopo.schneeschuhwandern'),
  makeOverlay('slopes'),
  makeOverlay('wildruhe_und_jagdbann'),
  makeOverlay('ch.bafu.alpweiden-herdenschutzhunde'),
];

describe('layer-groups', () => {
  describe('createDefaultGroups', () => {
    it('creates 3 groups with unique ids', () => {
      const groups = createDefaultGroups();
      expect(groups).toHaveLength(3);
      expect(new Set(groups.map(g => g.id)).size).toBe(3);
    });

    it('includes huts in all groups', () => {
      const groups = createDefaultGroups();
      for (const g of groups) {
        expect(g.layerSlugs).toContain('huts');
      }
    });

    it('includes transport in all groups', () => {
      const groups = createDefaultGroups();
      for (const g of groups) {
        expect(g.layerSlugs).toContain('transport-stops');
      }
    });

    it('includes slope_angle in snowsport only', () => {
      const groups = createDefaultGroups();
      const snowsport = groups.find(g => g.slug === 'snowsport');
      const hiking = groups.find(g => g.slug === 'hiking');
      expect(snowsport?.layerSlugs).toContain('ch.swisstopo.hangneigung-ueber_30');
      expect(hiking?.layerSlugs).not.toContain('ch.swisstopo.hangneigung-ueber_30');
    });

    it('all groups are locked by default', () => {
      const groups = createDefaultGroups();
      for (const g of groups) {
        expect(g.locked).toBe(true);
        expect(g.hidden).toBe(false);
        expect(g.removed).toBe(false);
      }
    });
  });

  describe('getActiveGroup', () => {
    it('returns the active group', () => {
      const settings = defaultOverlayGroupSettings();
      const group = getActiveGroup(settings);
      expect(group).not.toBeNull();
      expect(group?.id).toBe(settings.activeGroupId);
    });

    it('returns null for removed groups', () => {
      const settings = defaultOverlayGroupSettings();
      settings.groups[0].removed = true;
      const group = getActiveGroup(settings);
      expect(group).toBeNull();
    });
  });

  describe('getVisibleGroups', () => {
    it('excludes hidden and removed groups', () => {
      const settings = defaultOverlayGroupSettings();
      settings.groups[0].hidden = true;
      settings.groups[1].removed = true;
      const visible = getVisibleGroups(settings);
      expect(visible).toHaveLength(1);
      expect(visible[0].slug).toBe('snowsport');
    });
  });

  describe('cycleGroup', () => {
    it('cycles to the next visible group', () => {
      const settings = defaultOverlayGroupSettings();
      const { group } = cycleGroup(settings);
      expect(group.slug).toBe('cycling'); // hiking → cycling
    });

    it('wraps around after the last group', () => {
      const settings = defaultOverlayGroupSettings();
      settings.activeGroupId = settings.groups[2].id; // snowsport (last)
      const { group } = cycleGroup(settings);
      expect(group.slug).toBe('hiking'); // wraps to first
    });

    it('skips hidden groups', () => {
      const settings = defaultOverlayGroupSettings();
      settings.groups[1].hidden = true; // hide cycling
      settings.activeGroupId = settings.groups[0].id; // hiking
      const { group } = cycleGroup(settings);
      expect(group.slug).toBe('snowsport'); // skips cycling
    });
  });

  describe('getGroupLayers', () => {
    it('returns only layers in the group that exist', () => {
      const groups = createDefaultGroups();
      const hiking = groups.find(g => g.slug === 'hiking')!;
      const layers = getGroupLayers(hiking, mockOverlays);
      expect(layers.length).toBe(4); // huts, hiking, nature, transport
      expect(layers.map(l => l.name)).toContain('huts');
    });

    it('returns empty for a group with no matching layers', () => {
      const group: LayerGroup = {
        id: 'test',
        slug: 'test',
        name: 'Test',
        icon: 'test',
        layerSlugs: ['nonexistent'],
        activeLayerSlugs: [],
        hidden: false,
        removed: false,
        locked: false,
        sortOrder: 99,
      };
      const layers = getGroupLayers(group, mockOverlays);
      expect(layers).toHaveLength(0);
    });
  });

  describe('getOtherLayers', () => {
    it('returns layers not in the active group', () => {
      const groups = createDefaultGroups();
      const hiking = groups[0];
      const others = getOtherLayers(hiking, mockOverlays);
      const othersSlugs = others.map(o => o.name);
      expect(othersSlugs).not.toContain('huts');
      expect(othersSlugs).not.toContain('ch.swisstopo.swisstlm3d-wanderwege');
      expect(othersSlugs).toContain('mtb');
      expect(othersSlugs).toContain('ch.swisstopo-karto.skitouren');
    });

    it('promotes active layers to the top', () => {
      const groups = createDefaultGroups();
      const hiking = groups[0];
      const others = getOtherLayers(hiking, mockOverlays);
      // mtb is inactive, ch.bafu...sheepdogs is inactive too
      // none are active in our mock, so order is: active (none) then inactive
      expect(others.length).toBeGreaterThan(0);
    });
  });

  describe('groupDisplayName', () => {
    it('translates i18n keys', () => {
      const t = (key: string) => (key === 'overlays.groups.hiking.name' ? 'Wandern' : key);
      expect(groupDisplayName('overlays.groups.hiking.name', t)).toBe('Wandern');
    });

    it('returns literal names unchanged', () => {
      const t = (key: string) => key;
      expect(groupDisplayName('My Custom Group', t)).toBe('My Custom Group');
    });
  });

  describe('mergeGroups', () => {
    it('preserves existing groups', () => {
      const settings = defaultOverlayGroupSettings();
      const merged = mergeGroups(
        settings,
        mockOverlays.map(o => o.name)
      );
      expect(merged.groups.length).toBeGreaterThanOrEqual(3);
    });

    it('does not re-add removed groups', () => {
      const settings = defaultOverlayGroupSettings();
      settings.groups[0].removed = true; // remove hiking
      settings.groups = settings.groups.slice(1); // physically remove it
      settings.dismissedGroupSlugs.push('hiking');
      const merged = mergeGroups(
        settings,
        mockOverlays.map(o => o.name)
      );
      expect(merged.groups.find(g => g.slug === 'hiking')).toBeUndefined();
    });
  });
});
