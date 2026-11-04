/**
 * Default registry installation — import side effect: installs the
 * ordered entry array (array order documents precedence; geoplace-default
 * LAST so every geoplace target resolves, failing open). Imported by the
 * selection store so the registry is populated before any `open()`.
 */
import { createRegistry, setDefaultRegistry } from '@selection/registry';
import { accommodationEntry } from './accommodation';
import { amenityEntry } from './amenity';
import { amenityClusterEntry } from './amenity-cluster';
import { geoplaceDefaultEntry } from './geoplace-default';
import { transportEntry } from './transport';

// accommodation FIRST (accommodation-kind geoplace rows keep their
// detail surface); amenity then catches domain 'amenity' rows; the
// cluster entry owns the synthetic cluster-source targets;
// geoplace-default LAST so every geoplace target resolves, failing open.
export const entries = [
  accommodationEntry,
  amenityEntry,
  amenityClusterEntry,
  transportEntry,
  geoplaceDefaultEntry,
];

setDefaultRegistry(createRegistry(entries));
