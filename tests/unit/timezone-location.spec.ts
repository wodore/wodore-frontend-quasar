import { describe, it, expect } from 'vitest';
import { currentTimeZone, guessLocationFromTimezone } from '@services/timezone-location';

describe('timezone-location', () => {
  it('resolves known timezones to their representative coordinates', () => {
    expect(guessLocationFromTimezone('Europe/Zurich')).toEqual({
      lat: 47.3769,
      lng: 8.5417,
    });
    expect(guessLocationFromTimezone('Europe/Vienna')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
    expect(guessLocationFromTimezone('America/New_York')).toEqual({
      lat: 40.7128,
      lng: -74.006,
    });
  });

  it('resolves legacy zone aliases', () => {
    expect(guessLocationFromTimezone('Europe/Kiev')).toEqual(
      guessLocationFromTimezone('Europe/Kyiv')
    );
    expect(guessLocationFromTimezone('Asia/Calcutta')).toEqual(
      guessLocationFromTimezone('Asia/Kolkata')
    );
  });

  it('estimates unknown zones from their UTC offset and DST hemisphere', () => {
    // Asia/Colombo: fixed UTC+05:30, no DST → tropical latitude,
    // longitude ≈ 5.5 h × 15° east of Greenwich
    expect(guessLocationFromTimezone('Asia/Colombo')).toEqual({
      lat: 10,
      lng: 82.5,
    });

    // Northern hemisphere with DST → temperate northern latitude
    const dakota = guessLocationFromTimezone('America/North_Dakota/New_Salem');
    expect(dakota).not.toBeNull();
    expect(dakota!.lat).toBe(47);
    expect(dakota!.lng).toBeLessThan(0);
    expect(dakota!.lng).toBeGreaterThan(-105);
  });

  it('returns null for zones without location signal', () => {
    expect(guessLocationFromTimezone('UTC')).toBeNull();
    expect(guessLocationFromTimezone('Etc/UTC')).toBeNull();
  });

  it('returns null for zones the runtime does not know', () => {
    expect(guessLocationFromTimezone('Mars/Olympus_Mons')).toBeNull();
  });

  it('returns null for an empty zone', () => {
    expect(guessLocationFromTimezone('')).toBeNull();
  });

  it('exposes the device timezone', () => {
    expect(currentTimeZone()).not.toBe('');
  });
});
