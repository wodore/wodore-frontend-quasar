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
FROM node:20-alpine AS build-quasar

LABEL org.opencontainers.image.name="Wodore Frontend"
LABEL org.opencontainers.image.authors="tb@wodore.com"
LABEL org.opencontainers.image.url=https://wodore.com
LABEL org.opencontainers.image.source=https://github.com/wodore/wodore-frontend-quasar
LABEL org.opencontainers.image.description="Wodore frontend image all files served statically"
LABEL org.opencontainers.image.licenses=MIT

WORKDIR /app

# Install Quasar CLI globally
RUN yarn global add @quasar/cli

# Install dependencies efficiently
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile # --production

# Just copy the directories/files which are needed
COPY .env index.html package.json yarn.lock quasar.config.ts tsconfig.json tsconfig.vue-tsc.json .eslintignore .eslintrc.cjs ./
# keep direcory structure
COPY src/ ./src/
COPY src-pwa/ ./src-pwa/
COPY src-ssr/ ./src-ssr/
COPY public/ ./public/
RUN ls -al

# generate placeholders: VAR=@@VAR@@
# they are later replace by the replace_vars program
RUN cp .env .env.template \
  && sed -E 's/^(.*)=(.*)$/\1=@@\1@@/' .env.template > .env

# Build the Quasar PWA
# Load environment variables placeholder (they are replace during runtime)
# Somehow it does not work with only the .env file, that's why we export it first
RUN export $(grep -v '^#' .env | xargs) && quasar build -m pwa
################################################################################
## Stage 2: Serve with optimized Nginx                                        ##
################################################################################
FROM nginx:stable-alpine-slim AS serve

# Upgrade base system for security patches
RUN apk --no-cache upgrade \
  && rm -rf /var/cache/apk/*

# Remove default config and use a custom secure one
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy built PWA files from Quasar stage
COPY --from=build-quasar /app/dist/pwa /usr/share/nginx/html

# Set proper ownership and permissions for nginx
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html \
    && find /usr/share/nginx/html -type f -exec chmod 644 {} \;

# Copy compiled Go binary from build stage
COPY --from=build-replace-vars /replace_vars /usr/local/bin/replace_vars

# Copy nginx configurations
COPY docker/nginx-default.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx-proxy.conf /etc/nginx/conf.d/nginx-proxy.conf.not_used
COPY docker/nginx-local.conf /etc/nginx/conf.d/nginx-local.conf.not_used
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
