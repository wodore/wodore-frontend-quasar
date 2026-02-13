/**
 * Huts Overlay Configuration
 *
 * Defines filters, settings, and legend for the huts overlay.
 */

import type { OverlayConfig } from './types';

export const hutsConfig: OverlayConfig = {
  filters: [
    {
      id: 'hutTypes',
      label: 'Hüttentypen',
      type: 'multi-select',
      // Options will be populated dynamically from backend categories
      // in the overlay-config-store
      options: [],
      defaultValue: [], // Empty array = all selected by default
    },
  ],

  // Settings will be implemented in Phase 4+
  settings: [],

  // Legend populated dynamically from categories
  legend: {
    sections: [],
  },
};
