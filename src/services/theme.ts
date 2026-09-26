import { Dark } from 'quasar';

/**
 * Theme service — owns light/dark application, mirroring how
 * `services/locale.ts` owns language. The user setting
 * (`ui.theme`: 'light' | 'dark' | 'auto') is the source of truth;
 * 'auto' follows the OS preference and is the default (PRODUCT.md:
 * light default, follow-system on first visit, manual choice wins).
 *
 * Quasar's Dark plugin flips the `body--dark` / `body--light` classes,
 * which drive the surface custom properties in `app.scss`.
 */

export type ThemeMode = 'light' | 'dark' | 'auto';

const mediaQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

/** Sanitize persisted values; anything unknown resolves to 'auto'. */
export function resolveTheme(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'auto';
}

function systemPrefersDark(): boolean {
  return mediaQuery?.matches ?? false;
}

/** Apply a theme mode via the Quasar Dark plugin ('auto' follows the OS). */
export function applyTheme(mode: ThemeMode): void {
  Dark.set(mode === 'dark' || (mode === 'auto' && systemPrefersDark()));
}

/** Re-apply when the OS preference changes (no-op effect unless 'auto'). */
export function bindSystemTheme(getMode: () => ThemeMode): void {
  mediaQuery?.addEventListener('change', () => applyTheme(getMode()));
}
