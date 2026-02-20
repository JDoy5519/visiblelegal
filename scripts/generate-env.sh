#!/bin/bash

# Generate environment variables for client-side use
# This script runs at build time to create assets/js/env.js
#
# SECURITY — all values below are embedded in public JavaScript.
#
# Public-safe (intended to be visible to browsers):
# - META_PIXEL_ID:          Facebook Pixel ID (public by design)
# - GOOGLE_ANALYTICS_ID:    GA4 measurement ID (public by design)
# - TURNSTILE_SITE_KEY:     Cloudflare Turnstile site key (public by design)
# - FBCAPTURE_DEBUG:        Debug flag for CAPI logging
#
# Sensitive secrets (TURNSTILE_SECRET_KEY, META_ACCESS_TOKEN, etc.)
# are NEVER exposed here — they stay in Netlify env / server-side only.

set -e

# Create the assets/js directory if it doesn't exist
mkdir -p assets/js

# Create the env.js file with environment variables
cat > assets/js/env.js << EOF
window.ENV = {
  META_PIXEL_ID: "${META_PIXEL_ID:-}",
  GOOGLE_ANALYTICS_ID: "${GOOGLE_ANALYTICS_ID:-}",
  TURNSTILE_SITE_KEY: "${TURNSTILE_SITE_KEY:-}",
  FBCAPTURE_DEBUG: "${FBCAPTURE_DEBUG:-false}"
};
EOF

echo "Generated assets/js/env.js with environment variables"
