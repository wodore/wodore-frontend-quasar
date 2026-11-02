/**
 * Selection registry — MatchSpec evaluation, first-wins resolution,
 * memoization, fallback behavior, targetKey safety.
 * Spec: openspec/changes/add-place-interactions (capability place-registry).
 */
import { describe, it, expect, vi } from 'vitest';
import { createRegistry, matchSpec } from '@selection/registry';
import {
  definePresentation,
  targetKey,
  type MapTarget,
  type MatchSpec,
  type Presentation,
  type PropsBag,
} from '@selection/types';
import { SOURCES } from '@selection/taxonomy';

function target(partial: Partial<MapTarget> & { source: string; id: string }): MapTarget {
  return {
    key: targetKey({ source: partial.source, id: partial.id }),
    location: { lat: 46.5, lon: 8.0 },
    props: {},
    ...partial,
  } as MapTarget;
}

const geoplaceHut = target({
  source: SOURCES.geoplace,
  id: 'planing-hut',
  props: {
    domain: 'amenity',
    kind: { identifier: 'accommodation.hut', slug: 'hut' },
    name: 'Planinghütte',
  } satisfies PropsBag,
});

// ── targetKey ────────────────────────────────────────────────────────────

describe('targetKey', () => {
  it('is collision-free when ids contain the separator', () => {
    const a = targetKey({ source: 'transport', id: 'ch:sbb:123' });
    const b = targetKey({ source: 'transport:ch', id: 'sbb:123' });
    expect(a).not.toBe(b);
  });

  it('splits back unambiguously', () => {
    const source = 'transport';
    const id = 'ch:sbb:123';
    const key = targetKey({ source, id });
    const colon = key.indexOf(':');
    const len = Number(key.slice(0, colon));
    expect(key.slice(colon + 1, colon + 1 + len)).toBe(source);
    expect(key.slice(colon + 1 + len)).toBe(id);
  });
});

// ── matchSpec ────────────────────────────────────────────────────────────

describe('matchSpec', () => {
  const cases: Array<[string, MatchSpec, MapTarget, boolean]> = [
    ['source only', { source: SOURCES.geoplace }, geoplaceHut, true],
    ['wrong source', { source: SOURCES.transport }, geoplaceHut, false],
    ['domain match', { source: SOURCES.geoplace, domain: 'amenity' }, geoplaceHut, true],
    [
      'domain list match',
      { source: SOURCES.geoplace, domain: ['admin', 'amenity'] },
      geoplaceHut,
      true,
    ],
    ['domain mismatch', { source: SOURCES.geoplace, domain: 'admin' }, geoplaceHut, false],
    [
      'missing domain member',
      { source: SOURCES.geoplace, domain: 'amenity' },
      target({ source: SOURCES.geoplace, id: 'x', props: {} }),
      false,
    ],
    [
      'kindParent derived from identifier prefix',
      { source: SOURCES.geoplace, kindParent: 'accommodation' },
      geoplaceHut,
      true,
    ],
    [
      'kindParent mismatch',
      { source: SOURCES.geoplace, kindParent: 'shopping' },
      geoplaceHut,
      false,
    ],
    [
      'kindParent null without kind',
      { source: SOURCES.geoplace, kindParent: 'accommodation' },
      target({ source: SOURCES.geoplace, id: 'x', props: {} }),
      false,
    ],
    [
      'kind by identifier',
      { source: SOURCES.geoplace, kind: 'accommodation.hut' },
      geoplaceHut,
      true,
    ],
    ['kind by slug', { source: SOURCES.geoplace, kind: 'hut' }, geoplaceHut, true],
    [
      'kind list',
      { source: SOURCES.geoplace, kind: ['accommodation.bivouac', 'accommodation.hut'] },
      geoplaceHut,
      true,
    ],
    [
      'where escape hatch consumes the erased target',
      { source: SOURCES.geoplace, where: t => t.id === 'planing-hut' },
      geoplaceHut,
      true,
    ],
    ['where can veto', { source: SOURCES.geoplace, where: () => false }, geoplaceHut, false],
  ];

  it.each(cases)('%s', (_name, spec, t, expected) => {
    expect(matchSpec(spec, t)).toBe(expected);
  });
});

// ── registry ─────────────────────────────────────────────────────────────

const accommodation = definePresentation<{ name: string }>({
  id: 'accommodation',
  match: { source: SOURCES.geoplace, kindParent: 'accommodation' },
  seed: props => ({ name: String(props.name ?? '') }),
});

const geoplaceDefault = definePresentation<Record<string, unknown>>({
  id: 'geoplace-default',
  match: { source: SOURCES.geoplace },
});

describe('createRegistry', () => {
  it('first matching entry wins regardless of specificity', () => {
    const reg = createRegistry([geoplaceDefault, accommodation]);
    // geoplace-default is FIRST and also matches the hut → it wins.
    expect(reg.resolve(geoplaceHut)?.id).toBe('geoplace-default');
  });

  it('ordered array documents precedence (accommodation before default)', () => {
    const reg = createRegistry([accommodation, geoplaceDefault]);
    expect(reg.resolve(geoplaceHut)?.id).toBe('accommodation');
  });

  it('unknown domain fails OPEN to the geoplace-default entry', () => {
    const reg = createRegistry([accommodation, geoplaceDefault]);
    const water = target({
      source: SOURCES.geoplace,
      id: 'water-x',
      props: {
        domain: 'amenity',
        kind: { identifier: 'amenity.water_point', slug: 'water_point' },
      },
    });
    expect(reg.resolve(water)?.id).toBe('geoplace-default');
  });

  it('resolves memoized by target.key (stable object identity)', () => {
    const reg = createRegistry([accommodation, geoplaceDefault]);
    const a = reg.resolve(geoplaceHut);
    const b = reg.resolve({ ...geoplaceHut, props: { ...geoplaceHut.props } });
    expect(b).toBe(a);
  });

  it('unmatched source returns undefined with a dev warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const reg = createRegistry([accommodation, geoplaceDefault]);
      expect(reg.resolve(target({ source: 'unknown-src', id: 'y' }))).toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
      // memoized: a second resolve does not re-warn
      reg.resolve(target({ source: 'unknown-src', id: 'y' }));
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('clearMemo drops cached resolutions', () => {
    const reg = createRegistry([accommodation, geoplaceDefault]);
    reg.resolve(geoplaceHut);
    reg.clearMemo();
    expect(reg.resolve(geoplaceHut)?.id).toBe('accommodation');
  });
});

// ── definePresentation erasure ───────────────────────────────────────────

describe('definePresentation', () => {
  it('erases the generic entry to the registry-facing Presentation', () => {
    const erased: Presentation = accommodation; // compile-time erasure check
    expect(erased.id).toBe('accommodation');
    expect(erased.seed?.({ name: 'X' })).toEqual({ name: 'X' });
  });

  it('preserves fetch/seed optionality and mapLayers passthrough', () => {
    const entry = definePresentation<{ a: number }>({
      id: 'x',
      match: { source: 's' },
      mapLayers: [{ layer: 'wd-huts', minZoom: 9, idProp: 'slug' }],
      detailStart: 'minimized',
    });
    expect(entry.fetch).toBeUndefined();
    expect(entry.seed).toBeUndefined();
    expect(entry.mapLayers).toEqual([{ layer: 'wd-huts', minZoom: 9, idProp: 'slug' }]);
    expect(entry.detailStart).toBe('minimized');
  });
});
