# Design: Language Switch

## Context

- vue-i18n is installed with four locale files (`src/i18n/locales/{de,en,fr,it}.json`) but `src/boot/i18n.ts` hardcodes `locale: 'de'`; there is no runtime switching and no persistence.
- `src/stores/user-settings-store.ts` already persists `ui.language: string` (default `'de'`) to localStorage (`wodore:userSettings`) via Quasar `LocalStorage` with a debounced write — nothing currently reads or writes this field.
- The backend (Django + modeltrans) accepts a `lang` query parameter (`de`, `en`, `fr`, `it`) on localized endpoints with server-side fallback; the generated OpenAPI client types it (`Select language code: de, en, fr, it.`).
- ~10 frontend call sites hardcode `lang: 'de'` (`useMediaImages`, `useNearbyImages`, `overlay-config-store`, `WdHutAvailabilities`, `WdAccommodationAvailabilities`); `WdPlaceSearch.vue` already uses `locale.value`.
- Locale files are incomplete: `en` missing 13 keys, `fr`/`it` missing 30 keys vs. `de` (master schema); `en` has an extra `map.layers` key. ~16 components contain hardcoded German strings without `t()`.
- Quasar's own lang pack is static (`lang: 'de-CH'` in `quasar.config.ts`).
- App runs as PWA (no SSR in the default dev/build flow); stores have SSR guards anyway.

## Goals / Non-Goals

**Goals:**

- User-selectable UI language: German, English, French, Italian.
- Language persisted in the existing user settings store (localStorage) — **not** in the URL; routes and URLs stay unchanged.
- One coherent source of truth for the active locale that drives vue-i18n, the Quasar lang pack, and localized API requests.
- Language-dependent remote data is re-fetched when the language changes (map geojson, weather codes, overlay/media metadata, availability).
- All user-visible strings translatable; missing locale keys completed so no raw keys or German fallbacks appear in en/fr/it UI.
- Unit tests for locale resolution/persistence.

**Non-Goals:**

- Server-side persistence of the language preference (the settings store's future server-sync covers this later).
- Browser-language auto-detection on first visit (default stays `de`; can be added later).
- Translating user-generated or third-party content (backend handles localized content with fallback).
- Right-to-left (RTL) languages.
- Language-specific route aliases or SEO hreflang handling.

## Decisions

### D1: Active locale lives in the user settings store; a thin locale service synchronizes consumers

- `UserSettings.ui.language` is narrowed from `string` to `Locale` (`'de' | 'en' | 'fr' | 'it'`).
- New `src/services/locale.ts` exports the single entry points: `SUPPORTED_LOCALES`, `resolveLocale(value)` (validates + falls back to `de`), `getStoredLocale()`, `setLocale(locale)`, and `currentLocale()` (reactive read).
- `setLocale` writes the setting (store persists to localStorage automatically) and sets `i18n.global.locale.value`; Quasar lang pack switching is handled in the boot/i18n wiring.
- _Alternative rejected_: storing a separate bare `localStorage` key for the language — the user settings store already provides namespaced, typed, debounced persistence and is the requested home for this setting.

### D2: Locale is initialized at boot, not from the URL

- `src/boot/i18n.ts` reads `getStoredLocale()` when creating the i18n instance (Pinia is available in boot files; boot order already activates pinia before i18n — verified in `quasar.config.ts` boot array).
- `fallbackLocale: 'de'` on the i18n instance so partially translated keys degrade to German (mirrors backend fallback behavior).
- _Alternative rejected_: `Accept-Language`-style negotiation or URL query (`?lang=`) — explicitly out of scope per requirements ("lang should not be in the url").

### D3: Quasar framework lang pack switches dynamically via `$q.lang.set`

- Boot wiring keeps the statically configured `de-CH` default and applies the pack for the resolved locale at startup; `setLocale` applies the new pack via the Quasar `LangPack` API (dynamic imports from `quasar/lang/`: `de-CH`, `en-US`, `fr`, `it`).
- Packs are tiny; static imports of the four packs are acceptable and avoid async flicker. (If bundle size ever matters, switch to dynamic `import()` — note in code comment.)

### D4: API requests use the active locale explicitly at typed call sites

- Replace every hardcoded `lang: 'de'` with `lang: currentLocale()` at the ~10 affected call sites. The OpenAPI schema types `lang` per endpoint, so this stays compile-time safe.
- _Alternative rejected_: a fetch middleware injecting `lang` into every request URL — would hit endpoints that don't declare the parameter and bypasses the typed client contract.

### D5: Language-dependent data reloads reactively, no full page reload

- Stores/composables that hold or fetch localized remote data watch the reactive locale:
  - `huts-store`: availability geojson + hut list refetch on locale change (map sources update).
  - `meteo-store`: weather-code cache is keyed by language already; context setter re-runs with new locale.
  - `overlay-config-store`: legend/overlay metadata refetch.
  - Components that fetch per-view (`WdHutAvailabilities`, `WdAccommodationAvailabilities`, media composables): `watch` on locale triggers refetch, so open dialogs update without reopening.
- _Alternative rejected_: `window.location.reload()` on language change — loses map/dialog state, worse UX, unnecessary because all localized data is fetch-driven.

### D6: Language switcher is a compact toolbar component, always visible

- New `WdLanguageSwitcher.vue` (translate icon + current locale code) placed in the `MainLayout` header toolbar, after the feedback button and before `WdUser`. It renders a `q-menu` listing the four languages with checkmark on the active one.
- Menu entries show **native** language names ("Deutsch", "English", "Français", "Italiano") as constants — the established pattern for language pickers, independent of the active UI language. The existing `lang.*` i18n keys remain for descriptive text elsewhere.
- Works for logged-in and logged-out users, desktop and mobile (icon-only, same pattern as the other round toolbar buttons).
- _Alternative rejected_: only inside the `WdUser` menu — that menu is auth-gated; language must be selectable without login.

### D7: Locale files completed and key sets aligned

- `de.json` is the master schema (already enforced via `DefineLocaleMessage`); fill the 13 missing keys in `en`, 30 in `fr`/`it`, and add `map.layers` to de/fr/it (currently en-only).
- All newly externalized strings from the ~16 components get keys in **all four** files.
- `yarn lint` + `vue-tsc --noEmit` guard key/type consistency (vue-i18n schema typing catches structural drift at compile time).

## Risks / Trade-offs

- [Refetch storm on language switch] → Reloads are triggered from few central places (stores + open components' watchers); cheap endpoints (search, availability) are already excluded from the loading bar; acceptable one-off cost on explicit user action.
- [Quasar lang pack import grows bundle slightly] → Four packs are a few KB each; documented fallback to dynamic import.
- [Translated content from backend may be missing in some languages (backend falls back to German)] → Same fallback chain client-side (`fallbackLocale: 'de'`); UI remains consistent.
- [Incomplete translations slip in again over time] → vue-i18n message-schema typing makes `de.json` the source of truth for the key set; TypeScript flags missing keys in the message object shape.
- [localStorage unavailable (private mode edge cases)] → Quasar `LocalStorage` falls back to in-memory storage; language then applies for the session only — same behavior as all other settings.

## Migration Plan

1. Land the change on branch `feature/language-switch`; no backend deployment or data migration needed.
2. Existing users keep the effective default (`de`) since `ui.language` already defaults to `'de'`.
3. Rollback: revert the branch; persisted settings are forward-compatible (unknown `language` values fall back to `de` via `resolveLocale`).

## Open Questions

None — all decisions resolved during exploration.
