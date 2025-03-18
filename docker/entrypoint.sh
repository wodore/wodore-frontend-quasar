#!/bin/sh

echo "Setting environment variables with default values..."

# Define variables with default values (no space around =)
VARS="
DOMAIN=wodore.com
API_HOST=https://api.wodore.com
API_VERSION=v1
IMAGOR_KEY
UMAMI_WEBSITE_ID
UMAMI_WEBSITE_URL
STRIPE_ID
OICD_ISSUER_URL
OICD_CLIENT_ID
OICD_RESOURCE_ID
"

#FILES=$(find /usr/share/nginx/html -type f)  # Adjust path as needed
FILES=$(find /usr/share/nginx/html -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" \))

# Process each variable
echo "$VARS" | while read -r line; do
    var=$(echo "$line" | cut -d= -f1)
    value=$(printenv "$var")

    # If the variable is empty or contains only spaces, skip it
    if [[ -z "${var// /}" ]]; then
        continue
    fi

    # If value is empty, set it to ""
    if [ -z "$value" ] || [ "$value" = "$var" ]; then
        value=""
    fi

    # Replace only if the placeholder exists
    if grep -q "@@${var}@@" $FILES; then
        echo "  - ${var} with '${value}'"

        # Replace in parallel using xargs
        echo "$FILES" | xargs -P "$(nproc)" -I{} sed -i "s|@@${var}@@|${value}|g" "{}"
    else
        echo "  - ${var} not found"
    fi
done

echo "Starting Nginx: '$@'"
exec "$@"