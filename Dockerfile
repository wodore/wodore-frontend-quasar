################################################################################
## Stage 1: Build Quasar PWA                                                  ##
################################################################################
FROM node:20-alpine AS build-quasar

WORKDIR /app

# Install Quasar CLI globally
RUN yarn global add @quasar/cli

# Install dependencies efficiently
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile # --production

# Copy the rest of the source code
COPY . .

# generate placeholders: VAR=@@VAR@@
# they are later replace by the replace_vars program
RUN sed -E 's/^(.*)=(.*)$/\1=@@\1@@/' .env.template > .env

# Build the Quasar PWA
# Load environment variables placeholder (they are replace during runtime)
# Somehow it does not work with only the .env file, that's why we export it first
RUN export $(grep -v '^#' .env | xargs) && quasar build -m pwa

################################################################################
## Stage 2: Build replace_vars (Go)                                           ##
################################################################################
FROM golang:1.21-alpine AS build-replace-vars

# Install UPX and other required dependencies
RUN apk add --no-cache upx git

WORKDIR /go/src/app

# Install dependencies manually
RUN go install github.com/spf13/cobra-cli@latest

# Initialize a new Go module (only needed if one doesn’t exist)
RUN go mod init mycli || true

# Get required dependencies
RUN go get github.com/spf13/cobra

# Copy the Go source code
COPY docker/replace_vars.go .

# Build the binary (statically linked)
RUN go build -ldflags="-s -w" -o /replace_vars replace_vars.go \
  && upx --best --lzma /replace_vars
RUN chmod +x /replace_vars

################################################################################
## Stage 3: Serve with optimized Nginx                                        ##
################################################################################
FROM nginx:stable-alpine-slim AS serve

# Upgrade base system for security patches
RUN apk --no-cache upgrade \
  && rm -rf /var/cache/apk/*

# Remove default config and use a custom secure one
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY ./.env.template /dot_env_defaults

# Copy built PWA files from Quasar stage
COPY --from=build-quasar /app/dist/pwa /usr/share/nginx/html

# Copy compiled Go binary from build stage
COPY --from=build-replace-vars /replace_vars /usr/local/bin/replace_vars
#RUN chmod +x /usr/local/bin/replace_vars

ENV REPLACE_VARS_LOG_LEVEL=info

# Set up the entrypoint to replace variables before starting nginx
# Use a shell to expand the variable at runtime
ENTRYPOINT ["/bin/sh", "-c", "/usr/local/bin/replace_vars --template /dot_env_defaults --dir /usr/share/nginx/html --log-level ${REPLACE_VARS_LOG_LEVEL} -- \"$@\"", "--"]
CMD ["nginx", "-g", "daemon off;"]
