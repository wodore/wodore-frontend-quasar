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
# local dist
yarn build
# yarn serve # for testing

# docker
yarn docker:build
yarn docker:run # uses .env file
yarn docker:run-local # uses .env.local file
yarn docker:run-prod # uses .env.local.prod file
# or docker commands
docker build  -t wodore-frontend .
docker run -e WODORE_DOMAIN=wodore.com -e WODORE_API_HOST=https://api.wodore.com -e WODORE_IMAGOR_KEY=my_secret -e WODORE_MAPTILER_API_KEY=get_maptiler_key -p 9000:8080 wodore-frontend
# see .env for env variables
```

#### Publish docker image

```bash
export DOCKER_GITHUB_TOKEN=...
echo $DOCKER_GITHUB_TOKEN | docker login ghcr.io -u GITHUB_USERNAME --password-stdin
yarn docker:publish [-v] # -v: with version tags
```

## Links

- [_Wodore API_](https://api.wodore.com/v1/docs)
- [_Backend_](https://github.com/wodore/wodore-backend)
- [_Quasar_](https://quasar.dev/docs)
- [_vue-maplibre-gl_](https://github.com/indoorequal/vue-maplibre-gl): [docu](https://indoorequal.github.io/vue-maplibre-gl/)
- [_maplibre_](https://maplibre.org/): [docu](https://maplibre.org/maplibre-gl-js/docs/), [spec](https://maplibre.org/maplibre-style-spec/)
