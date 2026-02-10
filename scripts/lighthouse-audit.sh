#!/bin/bash

# Lighthouse Security Audit Script
# Generates Lighthouse reports in appropriate locations based on environment
# 
# Usage: ./scripts/lighthouse-audit.sh [url]
# 
# SECURITY: Reports are written to:
# - Local dev: ./.reports/lighthouse-security-report.json
# - Netlify CI: /tmp/lh/lighthouse-security-report.json
# 
# This prevents sensitive data from being published to the site.

set -e

# Default URL if not provided
URL="${1:-http://localhost:8080}"

echo "🚀 Running Lighthouse security audit on: $URL"

# Check if lighthouse is installed
if ! command -v lighthouse &> /dev/null; then
    echo "❌ Lighthouse CLI not found. Install with: npm install -g lighthouse"
    exit 1
fi

# Run Lighthouse audit with proper path handling
if [ "${NETLIFY:-}" = "true" ]; then
  mkdir -p /tmp/lh
  lighthouse "$URL" \
    --only-categories=security \
    --output=json \
    --output-path=/tmp/lh/lighthouse-security-report.json \
    --chrome-flags="--headless --no-sandbox --disable-gpu" \
    --quiet
else
  mkdir -p ./.reports
  lighthouse "$URL" \
    --only-categories=security \
    --output=json \
    --output-path=./.reports/lighthouse-security-report.json \
    --chrome-flags="--headless --no-sandbox --disable-gpu" \
    --quiet
fi

if [ $? -eq 0 ]; then
    echo "✅ Lighthouse security audit completed successfully"
    if [ "${NETLIFY:-}" = "true" ]; then
        echo "📊 Report saved to: /tmp/lh/lighthouse-security-report.json"
    else
        echo "📊 Report saved to: ./.reports/lighthouse-security-report.json"
    fi
    
    # Show summary for local development
    if [ "$NETLIFY" != "true" ]; then
        echo ""
        echo "📈 Security Score Summary:"
        node -e "
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('./.reports/lighthouse-security-report.json', 'utf8'));
            const securityScore = report.categories?.security?.score;
            if (securityScore !== null) {
                console.log(\`   Security Score: \${Math.round(securityScore * 100)}/100\`);
            } else {
                console.log('   Security Score: Not available');
            }
        " 2>/dev/null || echo "   Could not parse score from report"
    fi
else
    echo "❌ Lighthouse audit failed"
    exit 1
fi
