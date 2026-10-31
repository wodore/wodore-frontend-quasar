/**
 * Default registry installation — import side effect: installs the
 * ordered entry array (array order documents precedence; geoplace-default
 * LAST so every geoplace target resolves, failing open). Imported by the
 * selection store so the registry is populated before any `open()`.
 */
import { createRegistry, setDefaultRegistry } from '@selection/registry';
import { accommodationEntry } from './accommodation';
import { geoplaceDefaultEntry } from './geoplace-default';
import { transportEntry } from './transport';

// geoplace-default LAST so every geoplace target resolves, failing open.
export const entries = [accommodationEntry, transportEntry, geoplaceDefaultEntry];

setDefaultRegistry(createRegistry(entries));
