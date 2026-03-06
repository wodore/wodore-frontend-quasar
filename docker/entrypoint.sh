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
# Copy the selected config to the nginx http.d directory
cp "/etc/nginx/http.d/${CONFIG_FILE}.conf.not_used" "/etc/nginx/http.d/${CONFIG_FILE}.conf"
# Remove default config if using a custom one
if [ "$CONFIG_FILE" != "default" ]; then
  rm -f "/etc/nginx/http.d/default.conf"
fi
# Create necessary directories for nginx
mkdir -p /run/nginx
exec /usr/local/bin/replace_vars --template /dot_env_defaults --directory /usr/share/nginx/html --patterns="*.js,*.css,*.html,*.json" --log-level ${REPLACE_VARS_LOG_LEVEL:-info} -- "$@"
