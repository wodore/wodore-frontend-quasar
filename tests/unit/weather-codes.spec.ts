import { describe, expect, it } from 'vitest';

import { weatherSymbolDescription, weatherSymbolUrl } from '@/utils/weatherCodes';

/** Current API shape: symbols nested as { slug, url } */
const nestedEntry = {
  code: 3,
  slug: 'overcast',
  description_day: 'Bedeckt',
  description_night: 'Bedeckt',
  symbol_day: { slug: 'weather-icons-overcast-day', url: 'https://hub.stg.wodore.com/media/symbols/overcast-day_abc.svg' },
  symbol_night: { slug: 'weather-icons-overcast-night', url: 'https://hub.stg.wodore.com/media/symbols/overcast-night_def.svg' },
};

/** Legacy cached shape: symbols were plain strings (slug or URL) */
const legacyUrlEntry = {
  code: 3,
  description_day: 'Bedeckt',
  symbol_day: 'https://hub.stg.wodore.com/media/symbols/overcast-day_abc.svg',
  symbol_night: 'weather-icons-overcast-night', // bare slug — NOT a usable src
};

describe('weatherSymbolUrl', () => {
  it('resolves the day symbol url from the nested API shape', () => {
    expect(weatherSymbolUrl(nestedEntry, true)).toBe(
      'https://hub.stg.wodore.com/media/symbols/overcast-day_abc.svg'
    );
  });

  it('resolves the night symbol url from the nested API shape', () => {
    expect(weatherSymbolUrl(nestedEntry, false)).toBe(
      'https://hub.stg.wodore.com/media/symbols/overcast-night_def.svg'
    );
  });

  it('returns null when the nested url is null (no remote asset)', () => {
    const entry = { symbol_day: { slug: 'x', url: null } };
    expect(weatherSymbolUrl(entry, true)).toBeNull();
  });

  it('keeps legacy string URLs working', () => {
    expect(weatherSymbolUrl(legacyUrlEntry, true)).toBe(
      'https://hub.stg.wodore.com/media/symbols/overcast-day_abc.svg'
    );
  });

  it('rejects legacy bare slugs (not a usable image source)', () => {
    expect(weatherSymbolUrl(legacyUrlEntry, false)).toBeNull();
  });

  it('returns null for missing entries or symbols', () => {
    expect(weatherSymbolUrl(null, true)).toBeNull();
    expect(weatherSymbolUrl(undefined, false)).toBeNull();
    expect(weatherSymbolUrl({}, true)).toBeNull();
    expect(weatherSymbolUrl({ symbol_day: null }, true)).toBeNull();
  });
});

describe('weatherSymbolDescription', () => {
  it('resolves the localized day/night description', () => {
    expect(weatherSymbolDescription(nestedEntry, true)).toBe('Bedeckt');
    expect(weatherSymbolDescription(nestedEntry, false)).toBe('Bedeckt');
  });

  it('returns empty string for missing or non-string values', () => {
    expect(weatherSymbolDescription(null, true)).toBe('');
    expect(weatherSymbolDescription({}, false)).toBe('');
    expect(weatherSymbolDescription({ description_day: 42 }, true)).toBe('');
  });
});
