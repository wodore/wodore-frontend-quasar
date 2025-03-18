# Stage 1: Build the Quasar PWA
FROM node:20-alpine AS builder

# Set Quasar versions
ENV QUASAR_CLI_VERSION=2.4.1

WORKDIR /app

# Install Quasar CLI globally
RUN yarn global add @quasar/cli@$QUASAR_CLI_VERSION

# Install dependencies efficiently
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile # --production # only production does not work

# Copy the rest of the source code
COPY . .

# Build the Quasar PWA
# Load environment variables placeholder (they are replace during runtime)
RUN export $(grep -v '^#' docker/dot_env.placeholder | xargs) && quasar build -m pwa

# Stage 2: Serve with optimized Nginx
FROM nginx:stable-alpine-slim AS serve

# Upgrade base system for security patches
RUN apk --no-cache upgrade

# Remove default config and use a custom secure one
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built PWA files
COPY --from=builder /app/dist/pwa /usr/share/nginx/html

# Copy runtime placeholder replacement script
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080

# Run replacement script before nginx starts
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]