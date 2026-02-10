#!/bin/bash

# Cleanup Reports Script
# Removes any stray Lighthouse reports before build to prevent secret leakage
# 
# This script runs before every Netlify build to ensure no sensitive
# Lighthouse reports are accidentally published to the site.

set -e

echo "🧹 Cleaning up any stray Lighthouse reports..."

# Remove reports from common locations
rm -f ./lighthouse-security-report.json
rm -f ./.reports/lighthouse-security-report.json

# Find and remove any lighthouse reports in the project (maxdepth 3 for performance)
if find . -maxdepth 3 -name "lighthouse-security-report.json" -type f -print -delete 2>/dev/null; then
    echo "✅ Removed stray Lighthouse reports"
else
    echo "ℹ️  No stray Lighthouse reports found"
fi

# Ensure safe directory exists for CI writes
mkdir -p /tmp/lh

echo "✅ Cleanup complete - safe to proceed with build"
