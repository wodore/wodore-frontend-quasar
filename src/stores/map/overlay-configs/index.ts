/**
 * Overlay Configurations
 *
 * Central export for all overlay configurations.
 */

import type { OverlayConfigs } from './types';
import { hutsConfig } from './huts';

export * from './types';

export const overlayConfigs: OverlayConfigs = {
  huts: hutsConfig,
  // Future overlays:
  // 'transport-stops': transportConfig,
  // hiking: hikingConfig,
  // etc.
};
