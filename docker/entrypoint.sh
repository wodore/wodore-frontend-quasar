#!/bin/sh
CONFIG=${WODORE_NGINX_CONFIG:-nginx-local.conf}
# Copy the selected config to the nginx conf directory
cp /etc/nginx/conf.d/10_$CONFIG.not_used /etc/nginx/conf.d/10_$CONFIG
exec /usr/local/bin/replace_vars --template /dot_env_defaults --directory /usr/share/nginx/html --log-level ${REPLACE_VARS_LOG_LEVEL:-info} -- "$@"
