//
// Native app update remedy (API version banner): Play in-app immediate
// update when available, store entry otherwise, cancel-safe. Deliberately
// the only update-UI trigger — silent updates are Play auto-update's job.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getAppUpdateInfo, performImmediateUpdate, openAppStore } = vi.hoisted(() => ({
  getAppUpdateInfo: vi.fn(),
  performImmediateUpdate: vi.fn(),
  openAppStore: vi.fn(),
}));

vi.mock('@capawesome/capacitor-app-update', () => ({
  AppUpdate: { getAppUpdateInfo, performImmediateUpdate, openAppStore },
  AppUpdateAvailability: { UNKNOWN: 0, UPDATE_NOT_AVAILABLE: 1, UPDATE_AVAILABLE: 2, UPDATE_IN_PROGRESS: 3 },
}));

import { triggerNativeAppUpdate } from '@services/appUpdate';

const info = (overrides: Record<string, unknown> = {}) =>
  ({
    updateAvailability: 2, // UPDATE_AVAILABLE
    immediateUpdateAllowed: true,
    ...overrides,
  }) as never;

describe('triggerNativeAppUpdate', () => {
  beforeEach(() => {
    getAppUpdateInfo.mockReset();
    performImmediateUpdate.mockReset();
    openAppStore.mockReset();
  });

  it('runs the in-app immediate update when Play allows it', async () => {
    getAppUpdateInfo.mockResolvedValue(info({}));
    performImmediateUpdate.mockResolvedValue({ code: 0 });
    const outcome = await triggerNativeAppUpdate();
    expect(outcome).toBe('in-app');
    expect(performImmediateUpdate).toHaveBeenCalledTimes(1);
    expect(openAppStore).not.toHaveBeenCalled();
  });

  it('opens the store when an update exists but immediate is not allowed', async () => {
    getAppUpdateInfo.mockResolvedValue(info({ immediateUpdateAllowed: false }));
    openAppStore.mockResolvedValue(undefined);
    const outcome = await triggerNativeAppUpdate();
    expect(outcome).toBe('store');
    expect(performImmediateUpdate).not.toHaveBeenCalled();
    expect(openAppStore).toHaveBeenCalledWith({ androidPackageName: 'com.wodore.app' });
  });

  it('opens the store when no update is available (side-loaded builds)', async () => {
    getAppUpdateInfo.mockResolvedValue(info({ updateAvailability: 1 }));
    openAppStore.mockResolvedValue(undefined);
    await expect(triggerNativeAppUpdate()).resolves.toBe('store');
    expect(openAppStore).toHaveBeenCalledTimes(1);
  });

  it('opens the store when Play services are unavailable', async () => {
    getAppUpdateInfo.mockRejectedValue(new Error('UNAVAILABLE'));
    openAppStore.mockResolvedValue(undefined);
    await expect(triggerNativeAppUpdate()).resolves.toBe('store');
  });

  it('does nothing more when the user cancels the immediate update', async () => {
    getAppUpdateInfo.mockResolvedValue(info({}));
    performImmediateUpdate.mockRejectedValue(new Error('Result code: 1'));
    const outcome = await triggerNativeAppUpdate();
    expect(outcome).toBe('canceled');
    expect(openAppStore).not.toHaveBeenCalled();
  });

  it('still reports store when opening the store itself fails', async () => {
    getAppUpdateInfo.mockRejectedValue(new Error('UNAVAILABLE'));
    openAppStore.mockRejectedValue(new Error('not implemented'));
    await expect(triggerNativeAppUpdate()).resolves.toBe('store');
  });
});
