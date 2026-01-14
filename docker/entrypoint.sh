#!/bin/sh
CONFIG=${WODORE_NGINX_CONFIG:-nginx-local.conf}
# Map config names to actual file names
case "$CONFIG" in
  nginx-local.conf)
    CONFIG_FILE="local"
    ;;
  nginx-proxy.conf)
    CONFIG_FILE="proxy"
    ;;
  *)
    CONFIG_FILE="$CONFIG"
    ;;
esac
# Copy the selected config to the nginx conf directory
cp "/etc/nginx/conf.d/10_${CONFIG_FILE}.conf.not_used" "/etc/nginx/conf.d/10_${CONFIG_FILE}.conf"
exec /usr/local/bin/replace_vars --template /dot_env_defaults --directory /usr/share/nginx/html --patterns="*.js,*.css,*.html,*.json" --log-level ${REPLACE_VARS_LOG_LEVEL:-info} -- "$@"
