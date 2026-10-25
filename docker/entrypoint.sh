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
fi

# CDN pull origins (orig.*): always a deny-all robots.txt, independent
# of WODORE_ENV — nginx picks this file via the $robots_txt $host map
# (nginx-default.conf), so the origin hosts never serve the crawlable
# production robots.txt even though they serve the same content.
printf 'User-agent: *\nDisallow: /\n' > /usr/share/nginx/html/robots-origin.txt

# SEO proxies: replace the API host placeholder with the runtime API host
# (same source of truth as the @@WODORE_API_HOST@@ placeholders in index.html)
# and the hut-meta cache TTL with WODORE_SEO_CACHE_TTL (seconds).
# (No load_module needed: Alpine's nginx-mod-http-js ships its own
# /etc/nginx/modules/10_http_js.conf which nginx.conf loads.)
#
# WODORE_API_UPSTREAM (Kubernetes) overrides ONLY nginx's own proxy_pass
# targets: host[:port] of an in-cluster backend service (e.g.
# wd-backend-api.staging.svc.cluster.local:8008 — fully qualified, nginx's
# resolver ignores resolv.conf search domains). nginx resolves a static
# proxy_pass host at CONFIG-LOAD time — the 2026-10-25 public-DNS outage
# crash-looped the deployment ([emerg] host not found in upstream). With
# the override the proxies target http://$wodore_api_upstream, resolved
# at REQUEST time (resolver = cluster DNS nameserver from
# /etc/resolv.conf), and keep sending the public Host (from
# WODORE_API_HOST — Django ALLOWED_HOSTS matches it) plus
# X-Forwarded-Proto https (Traefik's TLS edge is bypassed, but Django
# must keep building https URLs). Empty/unset = public hostname,
# byte-for-byte the previous behavior; browser-facing env.js keeps the
# public WODORE_API_HOST either way (that is replace_vars, below —
# deliberately not overridden).
#
# WODORE_PUBLIC_API_URL (optional CDN base, Kubernetes) splits PUBLIC
# traffic onto the CDN name (see services/apiBase.ts for the SPA side):
# when set AND no WODORE_API_UPSTREAM override, the SEO proxies below
# (sitemaps, llms.txt, hut .md, hut meta subrequests) fetch through the
# CDN base too — the same public/unauthenticated GETs the SPA routes
# there, and the only server-side fetches whose API-host-relative
# content (og:image media URLs in hut meta) would otherwise leak the
# direct host onto public pages. WODORE_API_UPSTREAM wins when both
# are set: the in-cluster fetch bypasses CDN + Traefik on purpose and
# nginx already disk-caches the hut meta.
if [ -n "${WODORE_API_UPSTREAM:-}" ]; then
  # Tolerate a scheme or trailing path in the value; nginx wants host[:port].
  UPSTREAM="${WODORE_API_UPSTREAM#http://}"
  UPSTREAM="${UPSTREAM#https://}"
  UPSTREAM="${UPSTREAM%%/*}"
  RESOLVER="$(awk '/^nameserver/ {print $2; exit}' /etc/resolv.conf)"
  # Host header exactly as the backend receives it today: nginx defaults
  # to $proxy_host, i.e. the host[:port] of WODORE_API_HOST.
  PUBLIC_HOST="${WODORE_API_HOST:-http://localhost:8000}"
  PUBLIC_HOST="${PUBLIC_HOST#http://}"
  PUBLIC_HOST="${PUBLIC_HOST#https://}"
  PUBLIC_HOST="${PUBLIC_HOST%%/*}"
  sed -i "s|__WODORE_API_HOST__|http://\$wodore_api_upstream|g" "/etc/nginx/http.d/${CONFIG_FILE}.conf"
  sed -i "s|__WODORE_API_UPSTREAM_RESOLVER__|resolver ${RESOLVER:-127.0.0.11} valid=10s;|" "/etc/nginx/http.d/${CONFIG_FILE}.conf"
  sed -i "s|__WODORE_API_UPSTREAM_SET__|set \$wodore_api_upstream ${UPSTREAM};|" "/etc/nginx/http.d/${CONFIG_FILE}.conf"
  sed -i "s|__WODORE_API_UPSTREAM_HEADERS__|proxy_set_header Host ${PUBLIC_HOST}; proxy_set_header X-Forwarded-Proto https;|g" "/etc/nginx/http.d/${CONFIG_FILE}.conf"
else
  # Public CDN base set and no in-cluster upstream: the SEO proxies
  # fetch through the CDN. Trailing slash trimmed — /llms.txt appends
  # its path to the proxy_pass URL and must not become //llms.txt.
  if [ -n "${WODORE_PUBLIC_API_URL:-}" ]; then
    CDN_BASE="${WODORE_PUBLIC_API_URL%/}"
    sed -i "s|__WODORE_API_HOST__|${CDN_BASE}|g" "/etc/nginx/http.d/${CONFIG_FILE}.conf"
  else
    sed -i "s|__WODORE_API_HOST__|${WODORE_API_HOST:-http://localhost:8000}|g" "/etc/nginx/http.d/${CONFIG_FILE}.conf"
  fi
  # No upstream override: drop the override placeholder lines the
  # template carries for Kubernetes mode.
  sed -i "/__WODORE_API_UPSTREAM_/d" "/etc/nginx/http.d/${CONFIG_FILE}.conf"
fi
sed -i "s|__WODORE_SEO_CACHE_TTL__|${WODORE_SEO_CACHE_TTL:-604800}|g" "/etc/nginx/http.d/${CONFIG_FILE}.conf"
# X-Robots-Tag value for non-origin hosts (the $x_robots_tag map's
# default branch, nginx-default.conf): the staging public host gets
# "noindex, nofollow" as defense-in-depth next to its robots.txt
# Disallow; production public hosts get "" — nginx emits no header for
# an empty add_header value, so they are unchanged.
if [ "${WODORE_ENV}" != "production" ]; then
  X_ROBOTS_TAG_VALUE='"noindex, nofollow"'
else
  X_ROBOTS_TAG_VALUE='""'
fi
sed -i "s|__WODORE_STAGING_X_ROBOTS__|${X_ROBOTS_TAG_VALUE}|g" "/etc/nginx/http.d/${CONFIG_FILE}.conf"
# Page cache for /hut/*: 0 (default) = no-store like index.html. Only set
# >0 when a CDN sits in front AND deploys purge it — see docker/seo.js.
sed -i "s|__WODORE_SEO_PAGE_TTL__|${WODORE_SEO_PAGE_TTL:-0}|g" "/etc/nginx/http.d/${CONFIG_FILE}.conf" /etc/nginx/seo.js
# SEO language routing: the default language serves the bare (unprefixed)
# URL, every other language a locale prefix. Defaults mirror the SPA's
# i18n config (src/i18n/index.ts: FALLBACK_LOCALE='en', SUPPORTED_LOCALES
# de/en/fr/it) and the backend's DEFAULT_LANG setting.
sed -i "s|__WODORE_DEFAULT_LANG__|${WODORE_DEFAULT_LANG:-en}|g" /etc/nginx/seo.js
sed -i "s|__WODORE_LANG_PREFIXES__|${WODORE_LANG_PREFIXES:-de,en,fr,it}|g" /etc/nginx/seo.js

# Create necessary directories for nginx
mkdir -p /run/nginx
# The SEO meta cache must be writable by the nginx worker user — a fresh
# tmpfs/emptyDir (memory-backed cache) mount is root-owned.
chown -R nginx:nginx /var/cache/nginx/seo 2>/dev/null || true
exec /usr/local/bin/replace_vars --template /dot_env_defaults --directory /usr/share/nginx/html --patterns="*.js,*.css,*.html,*.json" --log-level ${REPLACE_VARS_LOG_LEVEL:-info} -- "$@"
