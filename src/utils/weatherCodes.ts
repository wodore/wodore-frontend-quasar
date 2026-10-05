/**
 * Weather code symbol helpers.
 *
 * The `/v1/meteo/weather_codes` API nests each symbol as
 * `{ slug, url }` — but older localStorage caches (written before the
 * sparse-fieldset migration) stored the plain string shape, where
 * `symbol_day`/`symbol_night` were bare slugs or URLs. Both shapes must
 * resolve, or every weather icon renders as a broken `<img>` (an object
 * stringifies to `[object Object]` and a bare slug resolves to a
 * relative 404).
 */

type WeatherCodeEntryLike = Record<string, unknown> | null | undefined;

/** True when a legacy string value is actually usable as an image source. */
function isUsableSrc(value: string): boolean {
  return /^https?:\/\//.test(value) || value.startsWith('/') || value.endsWith('.svg');
}

/**
 * Resolve the day/night symbol of a weather-code entry to an image URL.
 *
 * @param entry weather-code entry from the meteo store (either API shape)
 * @param isDay `true` for the day symbol, `false` for night
 * @returns an absolute/relative image URL, or `null` when no usable
 *   symbol exists (callers render their empty-state glyph instead)
 */
export function weatherSymbolUrl(entry: WeatherCodeEntryLike, isDay: boolean): string | null {
  if (!entry) return null;
  const symbol = entry[isDay ? 'symbol_day' : 'symbol_night'];
  if (!symbol) return null;

  // Current API shape: nested { slug, url } (url may be null server-side)
  if (typeof symbol === 'object') {
    const url = (symbol as { url?: unknown }).url;
    return typeof url === 'string' && isUsableSrc(url) ? url : null;
  }

  // Legacy cached shape: plain string (only usable when it is a URL)
  return typeof symbol === 'string' && isUsableSrc(symbol) ? symbol : null;
}

/**
 * Resolve the localized day/night description of a weather-code entry.
 */
export function weatherSymbolDescription(entry: WeatherCodeEntryLike, isDay: boolean): string {
  if (!entry) return '';
  const description = entry[isDay ? 'description_day' : 'description_night'];
  return typeof description === 'string' ? description : '';
}
