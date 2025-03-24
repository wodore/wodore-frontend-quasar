#!/bin/sh

# Set default config if not specified
CONFIG=${NGINX_CONFIG:-nginx-local.conf}

# Copy the selected config to the nginx conf directory
cp /etc/nginx/conf.d/$CONFIG.not_used /etc/nginx/conf.d/$CONFIG

ls -al /etc/nginx/conf.d

# Run the original CMD
exec /usr/local/bin/replace_vars --template /dot_env_defaults --directory /usr/share/nginx/html --log-level ${REPLACE_VARS_LOG_LEVEL:-info} -- "$@"
