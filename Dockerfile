################################################################################
## Stage 0: Build replace_vars (Go)                                           ##
################################################################################
FROM golang:1.21-alpine AS build-replace-vars
WORKDIR /go/src/app
COPY docker/replace_vars.go .
# Build the binary (statically linked)
RUN apk add --no-cache upx \
  && go build -ldflags="-s -w" -o /replace_vars replace_vars.go \
  && upx --best --lzma /replace_vars
RUN chmod +x /replace_vars

################################################################################
## Stage 1: Build Quasar PWA                                                  ##
################################################################################
FROM node:24-alpine AS build-quasar

LABEL org.opencontainers.image.name="Wodore Frontend"
LABEL org.opencontainers.image.authors="tb@wodore.com"
LABEL org.opencontainers.image.url=https://wodore.com
LABEL org.opencontainers.image.source=https://github.com/wodore/wodore-frontend-quasar
LABEL org.opencontainers.image.description="Wodore frontend image all files served statically"
LABEL org.opencontainers.image.licenses=MIT

WORKDIR /app

# Opt the PWA build into the external /env.js (placeholders rewritten by
# replace_vars at container start): keeps the HTML shell free of volatile
# values so the SEO edge can cache hut pages. Non-docker builds (dev,
# Capacitor, Pages previews) keep the inline env — see index.html.
ENV WODORE_EXTERNAL_ENV=1

# Set build arguments
ARG GIT_HASH
ENV GIT_HASH=${GIT_HASH}

# Check if GIT_HASH is set
RUN if [ -z "$GIT_HASH" ]; then \
  echo "Error: GIT_HASH build argument is required. Please provide it using --build-arg GIT_HASH=<hash>" && \
  exit 1; \
  fi

# Install Quasar CLI globally (pnpm comes from corepack via packageManager)
RUN corepack enable && pnpm add -g @quasar/cli

# Install dependencies efficiently (store cache mount = layer stays hot
# across builds even when package.json changes)
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/pnpm/store \
  pnpm install --frozen-lockfile --store-dir /pnpm/store

# Just copy the directories/files which are needed
COPY .env index.html package.json pnpm-lock.yaml quasar.config.ts tsconfig.json tsconfig.vue-tsc.json eslint.config.js ./
# keep direcory structure
COPY src/ ./src/
COPY src-pwa/ ./src-pwa/
COPY src-ssr/ ./src-ssr/
COPY public/ ./public/

# generate placeholders: VAR=@@VAR@@
# they are later replace by the replace_vars program
RUN cp .env .env.template \
  && sed -E 's/^(.*)=(.*)$/\1=@@\1@@/' .env.template > .env

# Build the Quasar PWA
# Load environment variables placeholder (they are replace during runtime)
# Somehow it does not work with only the .env file, that's why we export it first
RUN --mount=type=cache,target=/app/.quasar --mount=type=cache,target=/app/node_modules/.cache \
  export PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[:space:]') && \
  echo "Package version: $PACKAGE_VERSION" && \
  export $(grep -v '^#' .env | xargs) && quasar build -m pwa
################################################################################
## Stage 2: Serve with Alpine nginx + njs                                    ##
################################################################################
# Alpine's own nginx package — NOT the official nginx image: only Alpine's
# nginx can load Alpine's nginx-mod-http-js (njs) module. The official
# image builds nginx from source and apk refuses the version-pinned module
# (verified ABI conflict: "breaks: nginx-mod-http-js-...[nginx=...]").
# njs powers the SEO edge injection (docker/seo.js).
FROM alpine:3.24 AS serve

# Upgrade base system for security patches, then install nginx + njs.
# /var/cache/nginx/seo is the SEO meta cache (~1 KB per hut, capped at
# 64 MB by nginx): back it with a volume, or with memory via
# --tmpfs /var/cache/nginx/seo:rw,noexec,nosuid,size=64m (the entrypoint
# fixes tmpfs ownership either way).
RUN apk --no-cache add nginx nginx-mod-http-js \
  && apk --no-cache upgrade \
  && rm -rf /var/cache/apk/* \
  && rm -f /etc/nginx/http.d/default.conf \
  && mkdir -p /var/cache/nginx/seo /etc/nginx/conf.d \
  && chown -R nginx:nginx /var/cache/nginx

# Copy built PWA files from Quasar stage
COPY --from=build-quasar /app/dist/pwa /usr/share/nginx/html

# Copy compiled Go binary from build stage
COPY --from=build-replace-vars /replace_vars /usr/local/bin/replace_vars

# Copy nginx configurations and the njs SEO script (js_import'ed by
# nginx-default.conf; load_module is injected into nginx.conf by the
# entrypoint — load_module is a main-context directive).
COPY docker/nginx-default.conf /etc/nginx/http.d/default.conf.not_used
COPY docker/nginx-proxy.conf /etc/nginx/http.d/proxy.conf.not_used
COPY docker/nginx-local.conf /etc/nginx/http.d/local.conf.not_used
COPY docker/seo.js /etc/nginx/seo.js
COPY ./.env /dot_env_defaults

# Copy entrypoint script
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV REPLACE_VARS_LOG_LEVEL=info

EXPOSE 8080

# Set up the entrypoint to replace variables before starting nginx
# Use a shell to expand the variable at runtime
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]



