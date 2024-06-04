# `wodore-frontend-quasar`

Where to find your peak mountain base.

## Install the dependencies

```bash
yarn
```

## Generate assets

```bash
yarn run gen:<asset>
```

The following assets are used:

- `api`: Open API client ([`openapi-ts`](https://openapi-ts.pages.dev/)) (see `src/clients/`, [api docu](https://api.wodore.com/v1/docs))
- `icons`: Custom `wd` icons ([`fantasticon`](https://github.com/tancredi/fantasticon)) (stored in `src/extras/icons/svg`)
- `favs`: Favicons ([`icongenie`](https://quasar.dev/icongenie/introduction/)) (defined in `src/assets/icongenie/`)

### Start the app in development mode

```bash
quasar dev
# quasar dev:<mode>
```

### Build the app for production

```bash
yarn build
# yarn serve # for testing
```

## Links

- [_Wodore API_](https://api.wodore.com/v1/docs)
- [_Backend_](https://github.com/wodore/wodore-backend)
- [_Quasar_](https://quasar.dev/docs)
- [_vue-maplibre-gl_](https://github.com/indoorequal/vue-maplibre-gl): [docu](https://indoorequal.github.io/vue-maplibre-gl/)
- [_maplibre_](https://maplibre.org/): [docu](https://maplibre.org/maplibre-gl-js/docs/), [spec](https://maplibre.org/maplibre-style-spec/)
