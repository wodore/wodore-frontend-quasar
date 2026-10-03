import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// Mock @capacitor/preferences with an in-memory store
const mockStore = new Map<string, string>();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({
      value: mockStore.has(key) ? mockStore.get(key)! : null,
    })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      mockStore.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      mockStore.delete(key);
    }),
    keys: vi.fn(async () => ({ keys: [...mockStore.keys()] })),
    clear: vi.fn(async () => {
      mockStore.clear();
    }),
  },
}));

// Import AFTER mock (vi.mock hoists automatically, but be explicit)
import { storageGet, storageSet, storageHas, storageRemove, initStorage } from '@services/storage';

describe('storage abstraction', () => {
  beforeAll(async () => {
    await initStorage();
  });

  beforeEach(() => {
    // Clear both the mock store AND the memory cache between tests
    mockStore.clear();
  });

  it('writes and reads values', async () => {
    storageSet('test-key', { name: 'test', value: 42 });
    // The write goes to memory cache immediately
    expect(storageGet('test-key')).toEqual({ name: 'test', value: 42 });
    // Wait for the async persist to complete
    await new Promise(r => setTimeout(r, 10));
    // The mock store has the serialized value
    expect(mockStore.has('test-key')).toBe(true);
  });

  it('returns null for missing keys', () => {
    expect(storageGet('nonexistent')).toBeNull();
  });

  it('checks existence with storageHas', () => {
    expect(storageHas('check-key')).toBe(false);
    storageSet('check-key', 'value');
    expect(storageHas('check-key')).toBe(true);
  });

  it('removes keys', () => {
    storageSet('remove-key', 'data');
    expect(storageHas('remove-key')).toBe(true);
    storageRemove('remove-key');
    expect(storageHas('remove-key')).toBe(false);
    expect(storageGet('remove-key')).toBeNull();
  });

  it('handles primitives', () => {
    storageSet('string', 'hello');
    storageSet('number', 123);
    storageSet('boolean', true);
    expect(storageGet('string')).toBe('hello');
    expect(storageGet('number')).toBe(123);
    expect(storageGet('boolean')).toBe(true);
  });

  it('handles nested objects', () => {
    const settings = {
      ui: { theme: 'dark', language: 'de' },
      map: { defaultZoom: 10, overlayGroups: { groups: [{ id: '1', slug: 'hiking' }] } },
    };
    storageSet('nested', settings);
    expect(storageGet('nested')).toEqual(settings);
  });
});
