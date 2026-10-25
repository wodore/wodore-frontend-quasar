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
