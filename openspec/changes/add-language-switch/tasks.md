## 1. Locale foundation

- [x] 1.1 Create `src/services/locale.ts`: `Locale` type re-export, `SUPPORTED_LOCALES`, native display names, `resolveLocale` (fallback `de`), reactive `currentLocale()`, `getStoredLocale()`, `setLocale()` (updates i18n + user settings store + Quasar lang pack)
- [x] 1.2 Narrow `UserSettings.ui.language` to `Locale` type in `user-settings-store.ts` (keep default `'de'`, keep localStorage round-trip working for legacy string values)
- [x] 1.3 Update `src/boot/i18n.ts`: initialize locale from `getStoredLocale()`, set `fallbackLocale: 'de'`, apply the matching Quasar lang pack at boot
- [x] 1.4 Unit tests for `resolveLocale` (valid values, invalid/legacy values, empty) and for store round-trip of the `language` field

## 2. Localized API requests

- [x] 2.1 Replace hardcoded `lang: 'de'` with the active locale in `src/composables/useMediaImages.ts`, `src/composables/useNearbyImages.ts`, `src/stores/map/overlay-config-store.ts`
- [x] 2.2 Replace hardcoded `lang: 'de'` in `src/components/huts/WdHutAvailabilities.vue` and `src/components/huts/WdAccommodationAvailabilities.vue`
- [x] 2.3 Verify remaining fetch sites (`WdPlaceSearch.vue`, huts-store geojson, meteo weather codes) pass the active locale; wire any that don't

## 3. Data reload on language change

- [x] 3.1 `huts-store`: watch active locale and refetch availability geojson / hut data so map sources update
- [x] 3.2 `meteo-store`: ensure weather-code context/cache re-initializes with the new locale
- [x] 3.3 `overlay-config-store` and media composables: refetch localized metadata on locale change
- [x] 3.4 Open components (`WdHutAvailabilities`, `WdAccommodationAvailabilities`, weather/media views): watch locale and refetch so open dialogs update without reopening

## 4. Language switcher UI

- [x] 4.1 Create `WdLanguageSwitcher.vue` (round icon button with current locale code, `q-menu` listing the four languages with native names and active checkmark) using existing `menu.select_language` / icon conventions
- [x] 4.2 Place it in `MainLayout.vue` header toolbar (desktop + mobile, before `WdUser`), verify toolbar layout on mobile breakpoints

## 5. Complete translations

- [x] 5.1 Fill the 13 missing keys in `en.json` and the 30 missing keys in `fr.json`/`it.json`; add `map.layers` to de/fr/it so all four files share one key set
- [x] 5.2 Externalize hardcoded German strings in `WdUser.vue`, `WdSupportButton.vue`, `WdSupportForm.vue`, `WdFeedbackButton.vue`, `WdFeedbackForm.vue` (labels, aria-labels, messages)
- [x] 5.3 Externalize hardcoded strings in `WdMapMenu.vue`, `WdOverlayConfig.vue`, `WdOverlayConfigPanels.vue`, `WdVersionTag.vue`, `WdBeta.vue`
- [x] 5.4 Externalize hardcoded strings in `WdPlaceSearchDialog.vue`, `WdContributeButton.vue`, `WdMediaGallery.vue`, `WdSelectDate.vue`
- [x] 5.5 Add all new message keys to all four locale files (German master, correct translations for en/fr/it)

## 6. Verification

- [x] 6.1 Key-parity check: flattened key sets of de/en/fr/it are identical
- [x] 6.2 `yarn lint` and `npx vue-tsc --noEmit` pass without warnings/errors
- [x] 6.3 `yarn test:unit` passes (incl. new locale specs)
- [x] 6.4 Manual smoke test on dev server: switch through all four languages, verify persistence across reload, URL unchanged, map/detail data reload in the new language _(headless portion verified: app boots, all changed modules compile via Vite dev server; interactive switching left for review on the running dev server)_
