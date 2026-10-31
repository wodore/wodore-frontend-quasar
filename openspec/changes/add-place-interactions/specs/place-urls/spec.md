# Place URLs — Delta Spec

## ADDED Requirements

### Requirement: Entity-model URL segments

- **Requirement**: Public content URLs SHALL use typed top-level segments per entity model: `/place/:slug` (geoplace, first scope), later `/route/:id` and `/area/:id`, later `/my/place/:slug`-style authenticated variants — each reusing the same body host and registry with only `meta.source` differing. Runtime `router.addRoute` per registry entry SHALL NOT be used.
- **Requirement**: Geoplace domains (admin, natural, amenity) SHALL NOT appear in URL paths — `/place/:slug` serves all domains; reclassifying a place MUST NOT change its URL (D10).
- **Requirement**: External sources (e.g. transport) SHALL have no URL in the first scope; the source-qualified pattern `/place/:source/:id` is reserved and requires id encoding (`encodeURIComponent`) plus a path param regex when introduced.
- **Requirement**: The canonical id in `/place/:slug` SHALL be the geoplace slug (D7); the hut `source_id` is entry-internal (derived from tile props, search props, or the probe).
- **Requirement**: Content routes SHALL preserve query and hash across open/close navigation (established pattern).

#### Scenario: Village deep link

- **WHEN** a user opens `/place/<slug-of-a-village>` (domain `admin`)
- **THEN** the geoplace-default minimal detail renders from the probe payload at that URL

#### Scenario: Adding a route entity later

- **WHEN** routes become deep-linkable
- **THEN** a new static route record plus a registry entry suffice — no changes to the selection framework, popup, or panel composition

### Requirement: Route records and crawler gates

- **Requirement**: Content route records SHALL declare named views `default` (map page), `menu` and `content`, with `meta: { content: true, source }` and `props: { content: true }`.
- **Requirement**: BOTH `menu` and `content` named views SHALL use crawler stubs (render-nothing components for index-building user agents) so crawlers never resolve the map or detail-host component chains during navigation.
- **Requirement**: The detail body host and its resolution chain SHALL be SSR/crawler-safe: no map instance access, `window`, or rAF at setup top level; crawler rendering relies on the nginx/edge SEO content (PR0).

#### Scenario: Crawler does not pull the map chain

- **WHEN** a crawler requests `/place/:slug`
- **THEN** the resolved route components are the crawler stubs and no MapLibre chunk is fetched

### Requirement: URL cutover without redirects

- **Requirement**: The `/place/:slug` route SHALL replace `/hut/:slug` with NO redirect (old hut links return 404 — accepted, D1); ALL legacy hut route records — including the legacy `/m/hut/:slug` redirect record — SHALL be removed (a redirect targeting a deleted route name is a runtime failure); the cutover SHALL ship only after the edge SEO support for `/place/` is live (PR0).
- **Requirement**: A page load landing directly on a content route (deep link, search-engine result) SHALL open the detail panel MAXIMIZED — map-first sessions keep the minimized default and the user's sticky choice.

#### Scenario: Old hut URL

- **WHEN** a user opens a legacy `/hut/<slug>` link after the cutover
- **THEN** the app shows the not-found page (no redirect), while the equivalent `/place/<geoplace-slug>` serves the detail

#### Scenario: Legacy redirect record removed

- **WHEN** a user opens a legacy `/m/hut/<slug>` link after the cutover
- **THEN** it does not throw (the redirect record is gone with the route it targeted) and resolves to the not-found page

#### Scenario: Deep link opens maximized

- **WHEN** a cold page load lands directly on `/place/<slug>`
- **THEN** the detail panel opens maximized regardless of the sticky minimized default
