# Language Switch Specification

## ADDED Requirements

### Requirement: Supported languages

The frontend SHALL support exactly four UI languages: German (`de`), English (`en`), French (`fr`), and Italian (`it`).

#### Scenario: List of selectable languages

- **WHEN** the language switcher menu is opened
- **THEN** it offers exactly German, English, French and Italian, each shown with its native name

### Requirement: Language selection UI

The system SHALL provide a language switcher in the main header toolbar that is visible and usable for both authenticated and unauthenticated users on desktop and mobile.

#### Scenario: Switch language as anonymous mobile user

- **WHEN** an unauthenticated user on a mobile viewport taps the language button in the header
- **THEN** a menu with the four supported languages opens and selecting one switches the UI language

#### Scenario: Active language indicated

- **WHEN** the language menu is opened
- **THEN** the currently active language is visibly marked (checkmark/label)

### Requirement: Language persistence

The selected language SHALL be persisted in the user settings store (`ui.language`) and thereby in localStorage under `wodore:userSettings`. The language SHALL NOT be encoded in the URL, and no route changes when the language is switched.

#### Scenario: Persisted after reload

- **WHEN** the user selects French and later reloads the page or reopens the app
- **THEN** the UI starts in French

#### Scenario: URLs unchanged

- **WHEN** the user switches the language
- **THEN** the current route and URL remain unchanged (no query parameter or path segment is added)

### Requirement: Locale initialization and fallback

On application boot the system SHALL initialize the vue-i18n locale from the persisted user setting. If the stored value is missing, invalid, or unsupported, the system SHALL fall back to German (`de`). The i18n instance SHALL use `de` as fallback locale for missing message keys.

#### Scenario: First visit

- **WHEN** a user opens the app with no persisted settings
- **THEN** the UI language is German

#### Scenario: Invalid stored value

- **WHEN** the persisted `ui.language` is not one of `de`/`en`/`fr`/`it`
- **THEN** the UI language falls back to German and subsequent persistence stores a valid value once the user selects a language

#### Scenario: Missing translation key

- **WHEN** a message key is absent in the active locale file but present in `de.json`
- **THEN** the German text is displayed instead of a raw key

### Requirement: Framework and component library localization

When the UI language changes, the system SHALL also switch the Quasar framework lang pack (component-internal texts such as date-picker labels and aria labels) to the matching language pack.

#### Scenario: Quasar lang pack follows selection

- **WHEN** the user switches the UI language to Italian
- **THEN** Quasar components render their internal texts with the Italian lang pack

### Requirement: Localized API requests

All frontend requests to localized backend endpoints SHALL send the active locale via the `lang` query parameter instead of a hardcoded language.

#### Scenario: Fetching localized data

- **WHEN** localized data (huts, availability, weather codes, media/overlay metadata) is fetched while the active locale is French
- **THEN** the request includes `lang=fr`

### Requirement: Reload of language-dependent remote data

When the user switches the language, language-dependent remote data SHALL be re-fetched with the new locale without a full page reload, so visible content (map data, weather, availability, media metadata, open detail views) updates to the selected language.

#### Scenario: Map data refreshes

- **WHEN** the language is switched while the map with hut data is displayed
- **THEN** the localized map data is re-fetched for the new locale and the map reflects it

#### Scenario: Open detail view refreshes

- **WHEN** the language is switched while a hut detail view with availability or weather data is open
- **THEN** the displayed localized data is re-fetched and re-rendered in the new language

### Requirement: Complete translations

All four locale files SHALL contain the same set of message keys, and all user-visible strings in the UI SHALL be defined as translatable messages rather than hardcoded text.

#### Scenario: Key parity across locales

- **WHEN** the locale files are compared by flattened key set
- **THEN** `de.json`, `en.json`, `fr.json` and `it.json` expose identical key sets

#### Scenario: User-visible strings are translatable

- **WHEN** a component renders a label, button text, message, or aria-label
- **THEN** the text originates from the i18n message catalog for the active locale
