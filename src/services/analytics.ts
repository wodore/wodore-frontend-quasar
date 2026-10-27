// src/types/umami.d.ts
interface Umami {
  track(event_name: string, event_data?: { [key: string]: unknown }): Promise<string> | undefined;
}

declare let umami: Umami | undefined;

/** True when the user opted out via the WdUser/WdMapMenu toggle —
 * checked at CALL time so a mid-session disable stops custom events
 * immediately (the boot file additionally never injects the script
 * while the flag is set; auto pageviews end with the next visit).
 *
 * Exported as the single source of truth for the opt-out state —
 * boot/analytics.ts imports it for its injection gate. Reads RAW
 * localStorage on purpose: quasar's LocalStorage serializes
 * set('umami.disabled', true) to `__q_bool|1` (NOT raw 'true'), so the
 * read deliberately treats ANY non-null, non-'false' value as opted
 * out — fail-closed for encoded/unknown values, and testable outside
 * a full quasar runtime. A literal raw 'false' is the documented
 * manual re-enable override (quasar itself would write `__q_bool|0`,
 * which still counts as opted out). */
export function umamiOptedOut(): boolean {
  if (typeof window === 'undefined') return true; // SSR — never track
  try {
    const v = window.localStorage.getItem('umami.disabled');
    return v !== null && v !== 'false';
  } catch {
    return false; // storage unavailable — don't invent an opt-out
  }
}

// src/utils/umami.ts
export default function track(
  event_name: string,
  event_data?: { [key: string]: unknown }
): Promise<string> | undefined {
  if (umamiOptedOut()) return undefined;
  if (typeof umami !== 'undefined') {
    console.debug('track data: "' + event_name + '"', event_data);
    umami.track(event_name, event_data);
  } else {
    console.warn('Umami is not available.');
    return undefined;
  }
}

/** Fire an event once the Umami tracker script has actually loaded.
 *
 * Boot-time detections (e.g. the GPU tier) routinely resolve BEFORE
 * the tracker global exists: the boot file injects script.js at
 * browser idle (≤2s) and the fetch takes a round trip, so a direct
 * track() in that window is dropped ("Umami is not available"). This
 * defers exactly ONE attempt, polling the umami global every 500ms
 * until `deadlineMs` elapses — then drops silently, which is the
 * correct outcome on env-gated builds (dev/test/CI never load the
 * script). All track() gates apply at fire time (opt-out re-checked);
 * no queue: only the LAST call site per event should use this.
 *
 * Raw setInterval, not a VueUse composable, on purpose: the polling
 * lives outside any component/effect scope (plain service module,
 * explicit clearInterval) — useIntervalFn's scope-based auto-cleanup
 * buys nothing here. */
export function trackWhenUmamiReady(
  event_name: string,
  event_data?: { [key: string]: unknown },
  deadlineMs = 15_000
): void {
  if (typeof window === 'undefined') return; // SSR — never track
  if (umamiOptedOut()) return;

  const fire = (): boolean => {
    if (typeof umami === 'undefined') return false;
    track(event_name, event_data);
    return true;
  };

  if (fire()) return;
  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    if (fire() || Date.now() - startedAt >= deadlineMs) {
      window.clearInterval(timer);
    }
  }, 500);
}
