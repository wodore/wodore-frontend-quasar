// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as allure from 'allure-js-commons';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { useLocalPropertiesStore } from '@stores/local-properties-store';

// Quasar's web storage no-ops under happy-dom; back it with the real DOM storage
vi.mock('quasar', async importOriginal => {
  const actual = await importOriginal<typeof import('quasar')>();
  const makeStorage = (get: () => Storage) => ({
    getItem: (key: string) => {
      const raw = get().getItem(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    },
    set: (key: string, value: unknown) => get().setItem(key, JSON.stringify(value)),
    removeItem: (key: string) => get().removeItem(key),
    hasItem: (key: string) => get().getItem(key) !== null,
  });
  return {
    ...actual,
    LocalStorage: makeStorage(() => window.localStorage),
    SessionStorage: makeStorage(() => window.sessionStorage),
  };
});

const STORAGE_KEY = 'wodore:localProperties';
const SESSION_STORAGE_KEY = 'wodore:localPropertiesSession';

function readStored(): Record<string, { lat?: number; lng?: number; zoom?: number }> {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
}

function readSession(): Record<string, unknown> {
  return JSON.parse(window.sessionStorage.getItem(SESSION_STORAGE_KEY) ?? '{}');
}

describe('local-properties-store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    setActivePinia(createPinia());
  });

  it('initializes with Switzerland defaults and creates the storage key', () => {
    allure.label('feature', 'local-properties');
    allure.severity('critical');

    const store = useLocalPropertiesStore();

    expect(store.currentLocation.lat).toBeCloseTo(46.8);
    expect(store.currentLocation.lng).toBeCloseTo(8.2);
    expect(store.currentLocation.zoom).toBe(8);
    expect(store.lastActiveTab).toBe('map');
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('sets and merges location updates', () => {
    const store = useLocalPropertiesStore();

    store.setLocation({ lat: 46.5, lng: 7.5, zoom: 12, timestamp: 0 });
    store.updateLocation({ bearing: 90 });

    const location = store.getLastKnownLocation();
    expect(location.lat).toBe(46.5);
    expect(location.lng).toBe(7.5);
    expect(location.zoom).toBe(12);
    expect(location.bearing).toBe(90);
  });

  it('detects stale locations', () => {
    const store = useLocalPropertiesStore();

    store.persistentState.location.timestamp = Date.now() - 2 * 60 * 60 * 1000;
    expect(store.isLocationStale(60)).toBe(true);

    store.updateLocation({});
    expect(store.isLocationStale(60)).toBe(false);
  });

  it('persists location across stores (debounced)', async () => {
    const store = useLocalPropertiesStore();
    store.setLocation({ lat: 46.5, lng: 7.5, zoom: 12, timestamp: Date.now() });

    await vi.waitFor(
      () => {
        expect(readStored().location?.lat).toBe(46.5);
      },
      { timeout: 2000 }
    );

    setActivePinia(createPinia());
    const fresh = useLocalPropertiesStore();
    expect(fresh.currentLocation.lat).toBe(46.5);
    expect(fresh.currentLocation.zoom).toBe(12);
  });

  it('force-saves immediately without waiting for the debounce', () => {
    const store = useLocalPropertiesStore();
    store.setLocation({ lat: 46.1, lng: 7.9, zoom: 9, timestamp: Date.now() });
    store.forceSave();
    expect(readStored().location?.lat).toBe(46.1);
  });

  it('persists session state and clipboard', async () => {
    const store = useLocalPropertiesStore();

    store.setLastActiveTab('feedback');
    store.setClipboardLocation([46.13591, 6.81813]);
    await nextTick();

    expect(readSession().lastActiveTab).toBe('feedback');

    setActivePinia(createPinia());
    const fresh = useLocalPropertiesStore();
    expect(fresh.lastActiveTab).toBe('feedback');
    expect(fresh.clipboardLocation).toEqual([46.13591, 6.81813]);
  });

  it('parses location from the URL hash', () => {
    const store = useLocalPropertiesStore();

    window.location.hash = '#p=13.77/46.13591/6.81813';
    const parsed = store.parseLocationFromHash();
    expect(parsed).toMatchObject({ zoom: 13.77, lat: 46.13591, lng: 6.81813 });

    window.location.hash = '#p=invalid';
    expect(store.parseLocationFromHash()).toBeNull();

    window.location.hash = '';
    expect(store.parseLocationFromHash()).toBeNull();
  });

  it('prefers hash location over stored and default location', () => {
    const store = useLocalPropertiesStore();
    store.setLocation({ lat: 46.5, lng: 7.5, zoom: 12, timestamp: Date.now() });

    window.location.hash = '#p=13.77/46.13591/6.81813';
    const initial = store.getInitialLocation();
    expect(initial).toMatchObject({ zoom: 13.77, lat: 46.13591, lng: 6.81813 });

    // Without hash and with a stale stored location, defaults win
    window.location.hash = '';
    store.persistentState.location.timestamp = Date.now() - 2 * 60 * 60 * 1000;
    const fallback = store.getInitialLocation();
    expect(fallback.lat).toBeCloseTo(46.8);
    expect(fallback.lng).toBeCloseTo(8.2);
  });

  it('clears all state back to defaults', () => {
    const store = useLocalPropertiesStore();
    store.setLocation({ lat: 46.5, lng: 7.5, zoom: 12, timestamp: Date.now() });
    store.setLastActiveTab('feedback');

    store.clearAll();

    expect(store.currentLocation.lat).toBeCloseTo(46.8);
    expect(store.lastActiveTab).toBe('map');
  });
});
