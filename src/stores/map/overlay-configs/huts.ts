/**
 * Huts Overlay Configuration
 *
 * Defines filters, settings, and legend for the huts overlay.
 * This is a minimal configuration to enable the dialog in Phase 1.
 * Will be fully populated in Phase 2 with actual filter definitions.
 */

import type { OverlayConfig } from './types';

export const hutsConfig: OverlayConfig = {
  // Filters will be populated in Phase 2 after fetching categories from backend
  filters: [],

  // Settings will be implemented in Phase 4+
  settings: [],

  // Legend will be populated in Phase 3
  legend: {
    sections: [
      {
        title: 'Coming Soon',
        items: [
          {
            label: 'Legend information will be available soon',
          },
        ],
      },
    ],
  },
};
