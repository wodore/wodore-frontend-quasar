# Proposal: Language Switch

## Why

The Wodore frontend currently boots with a hardcoded German locale (`locale: 'de'` in `src/boot/i18n.ts`) even though vue-i18n locale files for de/en/fr/it exist and the backend already serves localized content with fallback for these four languages. Users cannot choose their language, translated UI content is incomplete (en missing 13 keys, fr/it missing ~30 keys), and several components contain hardcoded German strings, so the app is only fully usable in German.

## What Changes

- Add a user-facing language switcher (German, English, French, Italian) at an appropriate, always-accessible location in the app header.
- Persist the selected language in the existing `user-settings-store` (`ui.language`, localStorage-backed under `wodore:userSettings`) — the language is **not** encoded in the URL and routes remain unchanged.
- Initialize the vue-i18n locale from the persisted user setting on boot (fallback: `de`), switch the Quasar framework lang pack alongside, and re-load language-dependent remote data (huts, availability, weather codes, media/overlay metadata) when the language changes.
- Replace all hardcoded `lang: 'de'` API query parameters with the active locale.
- Complete the missing translation keys in `en.json`, `fr.json`, `it.json` and align key sets across all four locale files.
- Externalize hardcoded UI strings (German) into the locale files so all user-visible words are translatable.
- Add unit tests for the new locale handling (persistence, fallback, invalid values).

No breaking changes. The default language for first-time visitors remains German.

## Capabilities

### New Capabilities

- `language-switch`: User-facing language selection (de/en/fr/it) with localStorage persistence via the user settings store, vue-i18n + Quasar lang pack synchronization, localized API requests, and reload of language-dependent remote data on change.

### Modified Capabilities

<!-- None: no existing spec-level behavior changes (existing specs are unrelated: accommodation-availability, availability-scroll, day-label, mobile-image-stripe, mobile-stripe-add-slide, stacked-proportional, swiper-touch-coexistence). -->

## Impact

- **Boot/i18n**: `src/boot/i18n.ts` (locale initialization), new locale composable/service.
- **Stores**: `src/stores/user-settings-store.ts` (typed `language` field), `huts-store`, `meteo-store`, `map/overlay-config-store` (use active locale; reload on change).
- **API layer**: `src/clients/index.ts` and ~10 call sites in composables/components that currently hardcode `lang: 'de'` (`useMediaImages`, `useNearbyImages`, `WdHutAvailabilities`, `WdAccommodationAvailabilities`, `overlay-config-store`).
- **Components**: New `WdLanguageSwitcher` in the main toolbar; ~16 components with hardcoded strings to externalize (WdUser, WdSupport*, WdFeedback*, WdMapMenu, WdOverlayConfig\*, WdVersionTag, WdMediaGallery, WdBeta, WdPlaceSearchDialog, WdContributeButton, WdHutAvailabilities, WdAccommodationAvailabilities, WdSelectDate).
- **Locale files**: `src/i18n/locales/{de,en,fr,it}.json` completed and aligned.
- **Quasar config**: dynamic lang pack switching instead of static `de-CH`.
- **Tests**: new unit specs; `user-settings-store.spec.ts` unaffected (language field already persisted).
- **Backend**: none — the backend already supports `lang` query parameter with fallback.
