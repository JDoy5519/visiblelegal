# Visible Legal Marketing - Landing Page

FCA-regulated claims management company website helping clients reclaim money from mis-sold financial products.

## Mixed Content Playbook

### What is Mixed Content?

Mixed content occurs when a secure (HTTPS) webpage loads insecure (HTTP) resources. This creates security vulnerabilities and causes browser warnings. Modern browsers block mixed content by default.

### How to Avoid Mixed Content

1. **Always use HTTPS URLs** for external resources
2. **Download assets locally** if HTTPS is not available
3. **Use relative paths** for local assets (`./assets/image.png`)
4. **Test with our guardrail** before deploying

### Security Guardrails

We have automated checks to prevent mixed content:

```bash
# Check for mixed content issues
npm run check:mixed

# Run all security checks
npm test
```

### Where to Put Local Assets

- **Images**: `/assets/` directory
- **Fonts**: `/assets/fonts/` directory  
- **CSS/JS**: Root directory or `/assets/` for vendor files

### Policy for New External Assets

**All new external assets must be:**
- ✅ HTTPS-enabled, OR
- ✅ Downloaded locally and referenced relatively

**Never add HTTP-only external resources.**

### Manual Testing

After making changes, verify no mixed content issues:

1. Run `npm run check:mixed`
2. Test in browser dev tools (Security tab)
3. Check Lighthouse audit for mixed content warnings

### Emergency Override

If you must temporarily allow an HTTP resource, add it to the allow-list in `scripts/check-no-http.mjs`:

```javascript
const ALLOWED_PATTERNS = [
  /^http:\/\/localhost/,
  /^http:\/\/127\.0\.0\.1/,
  /^http:\/\/0\.0\.0\.0/,
  /^http:\/\/your-temporary-resource/,  // Add here
];
```

**Note**: This should only be temporary. Find an HTTPS alternative or download locally.

---

## Development

This is a static HTML/CSS/JS site with no build process required.

### Quick Start

1. Clone the repository
2. Serve files with any static server
3. Run security checks: `npm run check:mixed`

### Security Headers

The site includes comprehensive security headers via `_headers` file:
- Content Security Policy with `upgrade-insecure-requests`
- Strict Transport Security
- X-Frame-Options, X-Content-Type-Options
- Referrer Policy and Permissions Policy
