# `wodore-frontend-quasar`

Find the next best location in the mountains.

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

- [**Wodore API**](https://api.wodore.com/v1/docs)
- [**Quasar**](https://quasar.dev/docs)
- [**vue-maplibre-gl**](https://github.com/indoorequal/vue-maplibre-gl): [docu](https://indoorequal.github.io/vue-maplibre-gl/)
- [**maplibre**](https://maplibre.org/): [docu](https://maplibre.org/maplibre-gl-js/docs/), [spec](https://maplibre.org/maplibre-style-spec/)
