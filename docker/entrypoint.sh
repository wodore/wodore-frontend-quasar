#!/bin/sh
CONFIG=${WODORE_NGINX_CONFIG:-default}
# Map config names to actual file names
case "$CONFIG" in
  nginx-local.conf|local)
    CONFIG_FILE="local"
    ;;
  nginx-proxy.conf|proxy)
    CONFIG_FILE="proxy"
    ;;
  default|nginx-default.conf|"")
    CONFIG_FILE="default"
    ;;
  *)
    CONFIG_FILE="$CONFIG"
    ;;
esac
# Copy the selected config to the nginx http.d directory. Alpine's nginx
# includes http.d/*.conf INSIDE the http block; /etc/nginx/conf.d is
# included at MAIN context (outside http) and must never contain server
# blocks — so no conf.d symlink (that was for the old docker-library
# nginx base image, which included conf.d/ in http context).
cp "/etc/nginx/http.d/${CONFIG_FILE}.conf.not_used" "/etc/nginx/http.d/${CONFIG_FILE}.conf"
# Remove default config if using a custom one
if [ "$CONFIG_FILE" != "default" ]; then
  rm -f "/etc/nginx/http.d/default.conf"
fi
# Staging: block search engine indexing
if [ "${WODORE_ENV}" != "production" ]; then
  printf 'User-agent: *\nDisallow: /\n' > /usr/share/nginx/html/robots.txt
  # Bake a noindex into the HTML shell for crawlers that do not run JS
  # (the app sets the same via useMeta client-side, this covers the rest).
  sed -i 's|<head>|<head><meta name="robots" content="noindex, nofollow">|' /usr/share/nginx/html/index.html
  # Uncomment all directives below "# Staging" sections
  sed -i '/# Staging/{n;s/^    # //}' "/etc/nginx/http.d/${CONFIG_FILE}.conf"
fi

# SEO proxies: replace the API host placeholder with the runtime API host
# (same source of truth as the @@WODORE_API_HOST@@ placeholders in index.html)
# and the hut-meta cache TTL with WODORE_SEO_CACHE_TTL (seconds).
# (No load_module needed: Alpine's nginx-mod-http-js ships its own
# /etc/nginx/modules/10_http_js.conf which nginx.conf loads.)
sed -i "s|__WODORE_API_HOST__|${WODORE_API_HOST:-http://localhost:8000}|g" "/etc/nginx/http.d/${CONFIG_FILE}.conf"
sed -i "s|__WODORE_SEO_CACHE_TTL__|${WODORE_SEO_CACHE_TTL:-604800}|g" "/etc/nginx/http.d/${CONFIG_FILE}.conf"
# Page cache for /hut/*: 0 (default) = no-store like index.html. Only set
# >0 when a CDN sits in front AND deploys purge it — see docker/seo.js.
sed -i "s|__WODORE_SEO_PAGE_TTL__|${WODORE_SEO_PAGE_TTL:-0}|g" "/etc/nginx/http.d/${CONFIG_FILE}.conf" /etc/nginx/seo.js

# Create necessary directories for nginx
mkdir -p /run/nginx
exec /usr/local/bin/replace_vars --template /dot_env_defaults --directory /usr/share/nginx/html --patterns="*.js,*.css,*.html,*.json" --log-level ${REPLACE_VARS_LOG_LEVEL:-info} -- "$@"
