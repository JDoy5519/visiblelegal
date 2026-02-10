// build-nonce.js
// Generates a cryptographic nonce and injects it into:
//  - Netlify _headers (from _headers.template)
//  - All HTML files (replacing nonce="{NONCE}" tokens)
//
// Run this as part of your build, BEFORE deploying.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---- Settings (tweak if needed) ----
const HEADERS_TEMPLATE = path.join(process.cwd(), '_headers.template');
const HEADERS_OUTPUT   = path.join(process.cwd(), '_headers');
// Where to search/replace HTML files (site root by default)
const HTML_ROOT        = process.cwd();
// Token to replace in both _headers.template and HTML
const TOKEN            = '{NONCE}';

// Generate a strong base64 nonce (padding is OK per CSP spec)
function generateNonce(bytes = 16) {
  return crypto.randomBytes(bytes).toString('base64');
}

// Recursively find all .html files from a starting dir
function findHtmlFiles(startDir) {
  const results = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        // ignore common build dirs you don’t want to traverse (optional)
        if (!['node_modules', '.git'].includes(e.name)) walk(full);
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.html')) {
        results.push(full);
      }
    }
  }
  walk(startDir);
  return results;
}

function replaceInFile(filePath, token, replacement) {
  const original = fs.readFileSync(filePath, 'utf8');
  if (!original.includes(token)) return false;
  const updated = original.split(token).join(replacement);
  fs.writeFileSync(filePath, updated, 'utf8');
  return true;
}

function main() {
  // 1) Generate nonce
  const nonce = generateNonce(20); // 160 bits of entropy
  const nonceAttr = `nonce-${nonce}`; // for CSP header
  console.log(`[build-nonce] Generated nonce: ${nonce}`);

  // 2) Build _headers from template
  if (!fs.existsSync(HEADERS_TEMPLATE)) {
    console.error(`[build-nonce] ERROR: Missing ${HEADERS_TEMPLATE}`);
    process.exit(1);
  }
  const headersTpl = fs.readFileSync(HEADERS_TEMPLATE, 'utf8');
  if (!headersTpl.includes(TOKEN)) {
    console.error(`[build-nonce] ERROR: ${HEADERS_TEMPLATE} does not contain ${TOKEN}`);
    process.exit(1);
  }
  const headersOut = headersTpl.split(TOKEN).join(nonce);
  // Also support people who wrote 'nonce-{NONCE}' in the template already:
  // (If they wrote plain {NONCE} after 'nonce-', the split/join above is enough.)
  fs.writeFileSync(HEADERS_OUTPUT, headersOut, 'utf8');
  console.log(`[build-nonce] Wrote ${HEADERS_OUTPUT}`);

  // 3) Patch all HTML files with nonce attribute
  // Replace occurrences of nonce="{NONCE}" with nonce="<generated>"
  const htmlFiles = findHtmlFiles(HTML_ROOT);
  let patchedCount = 0;
  for (const file of htmlFiles) {
    const didReplace = replaceInFile(file, 'nonce="{NONCE}"', `nonce="${nonce}"`);
    if (didReplace) {
      patchedCount++;
      console.log(`[build-nonce] Patched nonce in: ${path.relative(process.cwd(), file)}`);
    }
  }

  if (patchedCount === 0) {
    console.warn('[build-nonce] WARNING: No HTML files contained nonce="{NONCE}". Did you add the token to your inline script tags?');
  } else {
    console.log(`[build-nonce] Done. Patched nonce in ${patchedCount} HTML file(s).`);
  }

  // 4) Optional: sanity check — warn if CSP line missing script-src-elem with nonce
  if (!headersOut.includes("script-src-elem") || !headersOut.includes("nonce-")) {
    console.warn("[build-nonce] WARNING: Your CSP may be missing script-src-elem 'nonce-<value>'. Double-check _headers.");
  }
}

main();
