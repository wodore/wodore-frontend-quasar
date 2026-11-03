# Tasks: Amenity Interactions

Owner decisions A1–A7 in design.md. Backend parallel PRs: near endpoint
(contract + count-sync invariant owned by the backend's openspec
change), tile `elevation`/`category_identifier` fields.

## 1. Layer claims & registry

- [x] `src/selection/map-layer-ids.ts`: `WD_ACCOMMODATIONS_LAYER`,
      `WD_ACCOMMODATIONS_CLUSTER_LAYER`, `CLUSTER_LAYER_SUFFIX`,
      `AMENITY_SUBTREES` (tier floors 5/9/13), `AMENITY_LAYERS`,
      `AMENITY_CLUSTER_LAYERS`
- [x] Accommodation entry: claim `wd-accommodations` (floor 5,
      idProp `slug`)
- [x] New amenity entry (`src/selection/entries/amenity/`): ten symbol
      claims at tier floors, popup-only, geoplace-detail fetch, seed
- [x] New amenity-cluster entry (`src/selection/entries/amenity-cluster/`):
      eleven cluster claims at tier floors, popup-only
- [x] Registry order (`entries/index.ts`): accommodation → amenity →
      amenity-cluster → transport → geoplace-default

## 2. Amenity popup

- [x] `WdAmenityPopup.vue`: name + icon + elevation, instant tile paint,
      detail enrichment (localized name below label zoom, kind symbol),
      graceful degradation (swatch fallback, hidden elevation row,
      skeleton name while loading)
- [x] i18n ×4 (de/en/fr/it): any new popup strings

## 3. Accommodations → hut details

- [x] Fetch wrap: `/v1/huts/{slug}` 404 → `/v1/geo/places/{slug}` mapped
      onto `HutSchemaDetails` (name, elevation, location, description,
      type_open ← kind)
- [x] Seed wrap: `category_identifier` (parent `accommodation`) +
      `color` → instant type avatar; `elevation` when tiles carry it
- [x] Toggle-close on second map click (existing D12 machinery — verify)

## 4. Cluster flow

- [x] `src/selection/cluster-behavior.ts`: decision (count<6 list /
      ≥6 zoom), served tile zoom (floor, maxzoom-capped), tile-URL
      cluster-param parsing, synthetic `cluster`-source target builder
- [x] `src/services/cluster-members.ts`: two-mode near client (cluster:
      z + category_tree + limit + forwarded params, importance-desc;
      proximity: radius + order=distance), `{data, count}` envelope,
      defensive row mapping
- [x] `WdClusterPopup.vue`: spinner → strict member list (color-marked,
      clickable, elevation), endpoint-count-trusted header, retry on
      failure; member click opens the place like an individual click
- [x] `WdMapView.vue`: cluster interception before the target pipeline,
      easeTo zoom-in for count≥6, feature-state highlight via featureRef

## 5. What's here

- [x] `src/selection/near-places.ts`: row → target mapping + entry
      resolution (accommodation parent → hut details; else amenity popup)
- [x] `WdMapView.vue`: unclaimed-tap probe (single-flight, latest wins),
      results → `openFromMap` (candidates for several), empty/failed →
      focus mode re-arm (same timer slot; newer-gesture guards)

## 6. Verification

- [x] Unit tests: claims/tier floors (interactive-layers.spec), cluster
      decision + tile zoom + param forwarding + target builder
      (cluster-click.spec), two-mode near contract + envelope
      (cluster-members.spec), geoplace seed (use-place.spec)
- [x] Existing suite green (incl. the #380 tab-focus catalog-refresh
      specs — map-catalog-store.spec)
- [x] `pnpm lint` + `npx vue-tsc --noEmit` clean

## 7. Follow-ups (out of scope, tracked here)

- [ ] Swap the near client to the typed API client when the endpoint
      enters the generated schema
- [ ] Leaflet-fallback interactivity for subset-profile amenity overlays
- [ ] Visual verification pass on staging after the backend near +
      tile-fields PRs deploy (popup states, cluster flows, what's-here)
