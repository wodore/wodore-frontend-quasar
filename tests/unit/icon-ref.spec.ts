import { describe, expect, it } from 'vitest';

import { formatIconRef, parseIconRef } from '@services/icons';

describe('icon reference format (pack/slug[@style])', () => {
  it('parses pack/slug with the default style implied', () => {
    expect(parseIconRef('fluent-emoji/tent')).toEqual({
      pack: 'fluent-emoji',
      slug: 'tent',
      style: 'simple',
    });
  });

  it('parses an explicit style suffix', () => {
    expect(parseIconRef('noto-emoji/grinning-face@mono')).toEqual({
      pack: 'noto-emoji',
      slug: 'grinning-face',
      style: 'mono',
    });
    expect(parseIconRef('fluent-emoji/sun@detailed')?.style).toBe('detailed');
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

  it('round-trips and omits the default style', () => {
    expect(formatIconRef({ pack: 'fluent-emoji', slug: 'tent', style: 'simple' })).toBe(
      'fluent-emoji/tent'
    );
    expect(formatIconRef(parseIconRef('noto-emoji/tent@mono')!)).toBe('noto-emoji/tent@mono');
    expect(
      formatIconRef(
        parseIconRef(formatIconRef({ pack: 'noto-emoji', slug: 'sun', style: 'detailed' })!)
      )
    ).toBe('noto-emoji/sun@detailed');
  });
});
