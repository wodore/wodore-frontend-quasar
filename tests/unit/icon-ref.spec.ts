import { describe, expect, it } from 'vitest';

import { availableStyle, formatIconRef, parseIconRef, type BackendIcon } from '@services/icons';

describe('icon reference format (pack/slug[@look])', () => {
  it('parses pack/slug with the color look implied', () => {
    expect(parseIconRef('fluent-emoji/tent')).toEqual({
      pack: 'fluent-emoji',
      slug: 'tent',
      style: 'color',
    });
  });

  it('parses an explicit look suffix', () => {
    expect(parseIconRef('noto-emoji/grinning-face@mono')).toEqual({
      pack: 'noto-emoji',
      slug: 'grinning-face',
      style: 'mono',
    });
    expect(parseIconRef('fluent-emoji/sun@color')?.style).toBe('color');
  });

  it('maps legacy flat/detailed suffixes to the color look', () => {
    expect(parseIconRef('fluent-emoji/sun@detailed')?.style).toBe('color');
    expect(parseIconRef('fluent-emoji/sun@simple')?.style).toBe('color');
  });

  it('rejects legacy iconify names, bare slugs and junk', () => {
    expect(parseIconRef('fluent-emoji-flat:tent')).toBeNull();
    expect(parseIconRef('tent')).toBeNull();
    expect(parseIconRef('')).toBeNull();
    expect(parseIconRef(null)).toBeNull();
    expect(parseIconRef(undefined)).toBeNull();
    expect(parseIconRef('fluent-emoji/tent@bogus')).toBeNull();
    expect(parseIconRef('fluent-emoji/')).toBeNull();
  });

  it('round-trips and omits the default look', () => {
    expect(formatIconRef({ pack: 'fluent-emoji', slug: 'tent', style: 'color' })).toBe(
      'fluent-emoji/tent'
    );
    expect(formatIconRef(parseIconRef('noto-emoji/tent@mono')!)).toBe('noto-emoji/tent@mono');
    // Legacy detailed refs converge to the bare color form
    expect(formatIconRef(parseIconRef('noto-emoji/sun@detailed')!)).toBe('noto-emoji/sun');
  });
});

describe('availableStyle (wire slot per look)', () => {
  const fluent: BackendIcon = {
    slug: 'tent',
    pack: 'fluent-emoji',
    lists: [],
    urls: { detailed: 'd.svg', simple: 's.svg', mono: 'm.svg' },
  } as unknown as BackendIcon;
  const noto: BackendIcon = {
    slug: 'tent',
    pack: 'noto-emoji',
    lists: [],
    urls: { detailed: 'd.svg' },
  } as unknown as BackendIcon;

  it('color prefers the flat art and falls back to detailed', () => {
    expect(availableStyle(fluent)).toBe('simple');
    expect(availableStyle(noto)).toBe('detailed');
  });

  it('mono resolves strictly — no silent color fallback', () => {
    expect(availableStyle(fluent, 'mono')).toBe('mono');
    expect(availableStyle(noto, 'mono')).toBeNull();
  });
});
