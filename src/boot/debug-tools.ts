/**
 * Debug tools boot: apply the `?debug=1|0` param to the persisted flag,
 * then load eruda (timing plugin + the in-repo nettools panel) in the
 * BACKGROUND — the app never waits on it (owner report: on throttled
 * loads the boot must not block on the debug tooling; nothing needs a
 * pre-mount attach anymore).
 *
 * Inert without the flag/param: no scripts are requested.
 */
import { boot } from 'quasar/wrappers';
import {
  applyDebugParam,
  disableDebugTools,
  enableDebugTools,
  isDebugEnabled,
} from '@services/debug-tools';

export default boot(() => {
  const param = applyDebugParam();
  if (param === '0') {
    // Explicit off also tears down the testing knobs (net/cache) —
    // debug off must never leave a throttled or cold session behind.
    disableDebugTools();
    return;
  }
  const on = param !== null ? param === '1' : isDebugEnabled();
  if (on) void enableDebugTools();
});
