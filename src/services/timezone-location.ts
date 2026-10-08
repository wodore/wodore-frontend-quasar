/**
 * Timezone-based location guess — permission-free, offline, coarse.
 *
 * Used ONLY to pick the initial map position on a user's first visit
 * (see `local-properties-store.getInitialLocation`): once the user moves
 * the map, the position is persisted and the guess never runs again.
 *
 * How it works: the browser already exposes the user's IANA timezone via
 * `Intl` (no permission prompt, no network request, no third party). We
 * look the zone up in a small table of representative coordinates.
 *
 * Accuracy is deliberately modest — a timezone spans a whole region, so
 * the result is the zone's main city / population centroid. Unknown zones
 * fall back to a UTC-offset estimate: longitude ≈ offset × 15°, latitude
 * from the DST sign difference between January and July (northern zones
 * shift one way, southern the other, tropical zones not at all).
 */

export interface LocationGuess {
  lat: number;
  lng: number;
}

/**
 * Representative coordinates per IANA timezone (main city / population
 * centroid). Europe first (the app's core market), then the common zones
 * worldwide. Known aliases (Kiev/Kyiv, Calcutta/Kolkata) are included so
 * older JVM/CLDR zone names resolve too.
 */
const TIMEZONE_COORDS: Record<string, LocationGuess> = {
  // Europe
  'Europe/Zurich': { lat: 47.3769, lng: 8.5417 },
  'Europe/Vaduz': { lat: 47.141, lng: 9.521 },
  'Europe/Berlin': { lat: 52.52, lng: 13.405 },
  'Europe/Vienna': { lat: 48.2082, lng: 16.3738 },
  'Europe/Paris': { lat: 48.8566, lng: 2.3522 },
  'Europe/Rome': { lat: 41.9028, lng: 12.4964 },
  'Europe/San_Marino': { lat: 43.9424, lng: 12.4578 },
  'Europe/Monaco': { lat: 43.7384, lng: 7.4246 },
  'Europe/Andorra': { lat: 42.5063, lng: 1.5218 },
  'Europe/Madrid': { lat: 40.4168, lng: -3.7038 },
  'Europe/Lisbon': { lat: 38.7223, lng: -9.1393 },
  'Europe/London': { lat: 51.5074, lng: -0.1278 },
  'Europe/Dublin': { lat: 53.3498, lng: -6.2603 },
  'Europe/Amsterdam': { lat: 52.3676, lng: 4.9041 },
  'Europe/Brussels': { lat: 50.8503, lng: 4.3517 },
  'Europe/Luxembourg': { lat: 49.6116, lng: 6.1319 },
  'Europe/Copenhagen': { lat: 55.6761, lng: 12.5683 },
  'Europe/Oslo': { lat: 59.9139, lng: 10.7522 },
  'Europe/Stockholm': { lat: 59.3293, lng: 18.0686 },
  'Europe/Helsinki': { lat: 60.1699, lng: 24.9384 },
  'Europe/Tallinn': { lat: 59.437, lng: 24.7536 },
  'Europe/Riga': { lat: 56.9496, lng: 24.1052 },
  'Europe/Vilnius': { lat: 54.6872, lng: 25.2797 },
  'Europe/Warsaw': { lat: 52.2297, lng: 21.0122 },
  'Europe/Prague': { lat: 50.0755, lng: 14.4378 },
  'Europe/Bratislava': { lat: 48.1486, lng: 17.1077 },
  'Europe/Budapest': { lat: 47.4979, lng: 19.0402 },
  'Europe/Ljubljana': { lat: 46.0569, lng: 14.5058 },
  'Europe/Zagreb': { lat: 45.815, lng: 15.9819 },
  'Europe/Belgrade': { lat: 44.7866, lng: 20.4489 },
  'Europe/Sarajevo': { lat: 43.8563, lng: 18.4131 },
  'Europe/Skopje': { lat: 41.9981, lng: 21.4254 },
  'Europe/Tirane': { lat: 41.3275, lng: 19.8187 },
  'Europe/Athens': { lat: 37.9838, lng: 23.7275 },
  'Europe/Sofia': { lat: 42.6977, lng: 23.3219 },
  'Europe/Bucharest': { lat: 44.4268, lng: 26.1025 },
  'Europe/Chisinau': { lat: 47.0105, lng: 28.8638 },
  'Europe/Kyiv': { lat: 50.4501, lng: 30.5234 },
  'Europe/Kiev': { lat: 50.4501, lng: 30.5234 },
  'Europe/Minsk': { lat: 53.9, lng: 27.5667 },
  'Europe/Moscow': { lat: 55.7558, lng: 37.6173 },
  'Europe/Malta': { lat: 35.8989, lng: 14.5146 },
  'Atlantic/Canary': { lat: 28.1235, lng: -15.4363 },
  'Atlantic/Reykjavik': { lat: 64.1466, lng: -21.9426 },
  // Americas
  'America/New_York': { lat: 40.7128, lng: -74.006 },
  'America/Toronto': { lat: 43.6532, lng: -79.3832 },
  'America/Chicago': { lat: 41.8781, lng: -87.6298 },
  'America/Winnipeg': { lat: 49.8951, lng: -97.1384 },
  'America/Denver': { lat: 39.7392, lng: -104.9903 },
  'America/Edmonton': { lat: 53.5461, lng: -113.4938 },
  'America/Los_Angeles': { lat: 34.0522, lng: -118.2437 },
  'America/Vancouver': { lat: 49.2827, lng: -123.1207 },
  'America/Anchorage': { lat: 61.2181, lng: -149.9003 },
  'America/Mexico_City': { lat: 19.4326, lng: -99.1332 },
  'America/Guatemala': { lat: 14.6349, lng: -90.5069 },
  'America/Bogota': { lat: 4.711, lng: -74.0721 },
  'America/Lima': { lat: -12.0464, lng: -77.0428 },
  'America/Santiago': { lat: -33.4489, lng: -70.6693 },
  'America/Argentina/Buenos_Aires': { lat: -34.6037, lng: -58.3816 },
  'America/Sao_Paulo': { lat: -23.5505, lng: -46.6333 },
  'America/Rio_Branco': { lat: -9.9754, lng: -67.8249 },
  // Asia / Middle East
  'Asia/Tokyo': { lat: 35.6762, lng: 139.6503 },
  'Asia/Seoul': { lat: 37.5665, lng: 126.978 },
  'Asia/Shanghai': { lat: 31.2304, lng: 121.4737 },
  'Asia/Beijing': { lat: 39.9042, lng: 116.4074 },
  'Asia/Hong_Kong': { lat: 22.3193, lng: 114.1694 },
  'Asia/Taipei': { lat: 25.033, lng: 121.5654 },
  'Asia/Singapore': { lat: 1.3521, lng: 103.8198 },
  'Asia/Kuala_Lumpur': { lat: 3.139, lng: 101.6869 },
  'Asia/Bangkok': { lat: 13.7563, lng: 100.5018 },
  'Asia/Jakarta': { lat: -6.2088, lng: 106.8456 },
  'Asia/Manila': { lat: 14.5995, lng: 120.9842 },
  'Asia/Ho_Chi_Minh': { lat: 10.8231, lng: 106.6297 },
  'Asia/Kolkata': { lat: 22.5726, lng: 88.3639 },
  'Asia/Calcutta': { lat: 22.5726, lng: 88.3639 },
  'Asia/Karachi': { lat: 24.8607, lng: 67.0011 },
  'Asia/Dhaka': { lat: 23.8103, lng: 90.4125 },
  'Asia/Dubai': { lat: 25.2048, lng: 55.2708 },
  'Asia/Tehran': { lat: 35.6892, lng: 51.389 },
  'Asia/Istanbul': { lat: 41.0082, lng: 28.9784 },
  'Asia/Jerusalem': { lat: 31.7683, lng: 35.2137 },
  // Africa
  'Africa/Cairo': { lat: 30.0444, lng: 31.2357 },
  'Africa/Johannesburg': { lat: -26.2041, lng: 28.0473 },
  'Africa/Nairobi': { lat: -1.2921, lng: 36.8219 },
  'Africa/Lagos': { lat: 6.5244, lng: 3.3792 },
  'Africa/Casablanca': { lat: 33.5731, lng: -7.5898 },
  'Africa/Algiers': { lat: 36.7538, lng: 3.0588 },
  'Africa/Tunis': { lat: 36.8065, lng: 10.1815 },
  // Oceania
  'Australia/Sydney': { lat: -33.8688, lng: 151.2093 },
  'Australia/Melbourne': { lat: -37.8136, lng: 144.9631 },
  'Australia/Brisbane': { lat: -27.4698, lng: 153.0251 },
  'Australia/Perth': { lat: -31.9505, lng: 115.8605 },
  'Pacific/Auckland': { lat: -36.8485, lng: 174.7633 },
};

/** IANA zones that carry no location signal → caller keeps its default. */
const NO_SIGNAL_ZONES = new Set([
  'UTC',
  'Etc/UTC',
  'Etc/GMT',
  'Etc/UCT',
  'Etc/Universal',
  'Etc/Zulu',
  'UCT',
  'Universal',
  'Zulu',
]);

/** The device's IANA timezone (empty string when unavailable). */
export function currentTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}

/**
 * Offset from UTC in minutes for an arbitrary IANA zone at a given instant
 * (`Date#getTimezoneOffset` sign convention: UTC − local, so UTC+05:30 →
 * −330). Returns null when the zone is unknown to the runtime.
 */
function zoneOffsetMinutes(timeZone: string, at: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    }).formatToParts(at);
    const name = parts.find(p => p.type === 'timeZoneName')?.value ?? '';
    // "GMT+05:30" / "GMT-11" / "GMT" — converted to the
    // Date#getTimezoneOffset convention (UTC − local): UTC+05:30 → −330
    const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) return name === 'GMT' ? 0 : null;
    const sign = match[1] === '-' ? 1 : -1;
    return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3] ?? '0', 10));
  } catch {
    return null;
  }
}

/**
 * Guess the user's location from their timezone. Coarse by design — the
 * result is the zone's representative point, accurate enough to open the
 * map "somewhere near home" without any permission prompt.
 *
 * @param timeZone IANA zone to resolve (defaults to the device zone)
 * @returns coordinates, or null when the zone carries no signal (UTC) or
 *          is unknown to the runtime — callers then keep their default
 */
export function guessLocationFromTimezone(
  timeZone: string = currentTimeZone()
): LocationGuess | null {
  if (!timeZone || NO_SIGNAL_ZONES.has(timeZone)) {
    return null;
  }

  const known = TIMEZONE_COORDS[timeZone];
  if (known) {
    return { ...known };
  }

  // Unknown zone — estimate from the UTC offset. Longitude: 24 h × 360°,
  // so 15° per hour east of Greenwich. Latitude: compare the zone's DST
  // shift in January vs July — northern zones shift one way, southern the
  // other, tropical ones not at all.
  const year = new Date().getUTCFullYear();
  const january = zoneOffsetMinutes(timeZone, new Date(Date.UTC(year, 0, 1)));
  const july = zoneOffsetMinutes(timeZone, new Date(Date.UTC(year, 6, 1)));
  const now = zoneOffsetMinutes(timeZone, new Date());
  if (january === null || july === null || now === null) {
    return null;
  }

  const lat = july < january ? 47 : january < july ? -28 : 10;
  const lng = (-now / 60) * 15;
  return {
    lat: Math.max(-60, Math.min(60, lat)),
    lng: Math.max(-180, Math.min(180, Math.round(lng * 100) / 100)),
  };
}
