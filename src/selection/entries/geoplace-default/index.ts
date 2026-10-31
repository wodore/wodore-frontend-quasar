/**
 * geoplace-default entry — the fail-open fallback for every geoplace
 * target that matches nothing more specific (unknown domains/kinds
 * render generically from payload fields; new backend kinds work
 * automatically).
 *
 * PR1a stub: no surface loaders yet — nothing renders through it while
 * the only content route is accommodation-bound. PR2 brings the popup
 * component and the minimal probe-payload detail (+ generic
 * title/actions zone defaults).
 */
import { definePresentation } from '@selection/types';

export const geoplaceDefaultEntry = definePresentation<Record<string, unknown>>({
  id: 'geoplace-default',
  match: { source: 'geoplace' },
  capabilities: ['popup'],
});
