/**
 * geoplace-default entry — the fail-open fallback for every geoplace
 * target that matches nothing more specific (unknown domains/kinds
 * render generically from payload fields; new backend kinds work
 * automatically — fail open, never blank).
 *
 * Popup content: props-only generic rendering (localized name at render
 * time, kind symbol → tier fallback, elevation, description snippet).
 * PR1b adds the minimal probe-payload detail component to the barrel.
 */
import { definePresentation } from '@selection/types';

export const geoplaceDefaultEntry = definePresentation<Record<string, unknown>>({
  id: 'geoplace-default',
  match: { source: 'geoplace' },
  capabilities: ['popup'],
  surfaces: () => import('./surfaces'),
});
