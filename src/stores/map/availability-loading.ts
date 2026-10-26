/**
 * Availability date-load spinner state.
 *
 * Module-scope ref shared by two owners on purpose: the writer is the
 * map-catalog store (the date pick swaps the wd-bookings tile URLs and
 * settles the spinner on the map's `sourcedata` event — map-coupled
 * logic that stays there), while the reader is WdSelectDate's spinner
 * glyph. Keeping the ref in this dependency-free module lets
 * WdSelectDate — bundled into the eager MainLayout chunk — share the
 * state WITHOUT statically importing the map-store cluster chunk,
 * which would drag the MapLibre vendor chunk onto every crawler's
 * download list (follow-up to PR #347).
 */
import { ref } from 'vue';

/** True from the date pick's setTiles call until the tile source
 * settles — held for a 600ms minimum so the user always sees the
 * state change (empty 204 tiles included). */
export const availabilityLoading = ref(false);
