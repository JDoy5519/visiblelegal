# Tracking + Submit Pipeline Implementation Summary

## Overview
Implemented a robust, debuggable tracking and submission pipeline for `/iva` with explicit dev mode, comprehensive logging, and proper error handling.

## Files Modified

### 1. `netlify/functions/submit.js`
**Changes:**
- Added `isDevRequest()` helper to detect dev mode via query param `dev=1` or header `x-vlm-dev=1`
- Added bypass mode: when `dev=1&bypass=1`, requires `x-debug-key` header matching `DEBUG_BYPASS_KEY` env var
- In bypass mode: skips Turnstile verification and Make webhook call, returns success with debug info
- Added verbose error responses in dev mode:
  - `TURNSTILE_FAILED`: includes `turnstile.success` and `turnstile.error_codes`
  - `BAD_PAYLOAD`: includes `expectedShape` and `gotKeys`
  - `MAKE_UPSTREAM`: includes `status` and `textSnippet`
  - All dev errors include `eventId` and `code` field
- Production responses remain minimal: `{ok:true,eventId}` or `{ok:false,message}`

### 2. `iva/script.js`
**Changes:**
- Updated dev mode detection: `DEV = qsl.get('dev') === '1'` (was `has('dev')`)
- Added `BYPASS` flag: `DEV && qsl.get('bypass') === '1'`
- Added debug overlay (dev mode only) showing:
  - Consent status
  - Pixel loaded/initialized status
  - Last eventId
  - Last submit status
  - Last error message
  - Backend error code
- Fixed Meta Pixel loading:
  - Only loads after `localStorage.getItem('vlm_cookie_consent') === 'accepted'`
  - Updates debug state when loading/initializing
  - Fires PageView once on load
  - Fires ViewContent once on `/iva` path
- Fixed Turnstile token extraction:
  - Checks `fields['cf-turnstile-response']` first
  - Falls back to `fields['cf_turnstile_token']`
  - Then checks `#cf_token` DOM element value
  - Finally checks `input[name="cf-turnstile-response"]` value
- Fixed form submission:
  - Payload structure: `{formId, fields, turnstileToken, userAgent, sourceUrl, eventId}`
  - In bypass mode: appends `?dev=1&bypass=1` to endpoint URL
  - Adds `x-debug-key` header in bypass mode (from `window.ENV.DEBUG_BYPASS_KEY`)
  - Updates debug state throughout submission process
- Fixed Lead event firing:
  - Only fires after `res.ok && responseData?.ok === true`
  - Uses correct format: `fbq('track', 'Lead', {}, { eventID: eventId })`
  - Deduplication via `sessionStorage.getItem('lead_fired_<eventId>')`
  - Updates debug state on success/failure
- Added test harness (`window.vlmDebug`):
  - `fireLead(eventId)` - Manually fire Lead event
  - `checkPixel()` - Check pixel status
  - `simulateSuccess(eventId)` - Simulate successful submit
  - `getState()` - Get current debug state

## Key Features

### Dev Mode
- Activated via `?dev=1` query parameter
- Shows debug overlay in bottom-right corner
- Verbose console logging
- Detailed error responses from backend

### Bypass Mode
- Activated via `?dev=1&bypass=1` query parameter
- Requires `DEBUG_BYPASS_KEY` env var set
- Requires `x-debug-key` header matching env var
- Skips Turnstile verification
- Skips Make webhook call
- Returns success immediately for testing

### Production Mode
- No debug overlay
- No verbose logging
- Minimal error responses
- Full Turnstile + Make enforcement

## Test Plan

### 1. Consent Off → No Pixel Network Calls
**Steps:**
1. Clear `localStorage` (or set `vlm_cookie_consent` to `rejected`)
2. Load `/iva?dev=1`
3. Open Network tab, filter for `facebook.com/tr`
4. Verify: No network requests to Facebook
5. Check debug overlay: Consent should show "not accepted", Pixel Loaded should be "no"

**Expected:**
- No Facebook network calls
- Debug overlay shows consent: "not accepted"
- Console shows: `[Meta] No consent - pixel will not load`

### 2. Consent On → PageView + ViewContent Appear
**Steps:**
1. Set `localStorage.setItem('vlm_cookie_consent', 'accepted')`
2. Load `/iva?dev=1`
3. Open Network tab, filter for `facebook.com/tr`
4. Wait 2-3 seconds
5. Verify: Two requests to `facebook.com/tr`:
   - One with `PageView` event
   - One with `ViewContent` event
6. Check debug overlay: Pixel Loaded and Pixel Init should be "yes"

**Expected:**
- Two Facebook network requests visible
- Debug overlay shows: Pixel Loaded: "yes", Pixel Init: "yes"
- Console shows: `[Meta] PageView fired` and `[Meta] ViewContent fired`

### 3. Submit in Bypass Mode → Success + Lead Fires
**Steps:**
1. Set `window.ENV.DEBUG_BYPASS_KEY = 'your-debug-key'` in console (or set in HTML)
2. Set `localStorage.setItem('vlm_cookie_consent', 'accepted')`
3. Load `/iva?dev=1&bypass=1`
4. Fill form (or use `?autofill=1` shortcut)
5. Submit form
6. Check Network tab: `/api/submit?dev=1&bypass=1` should return `{ok:true, bypass:true, eventId, ...}`
7. Check Network tab: Facebook `tr` request should show `Lead` event
8. Check debug overlay: Last Submit should be "success", Last EventId should show the eventId
9. Verify thank-you modal opens

**Expected:**
- `/api/submit` returns `{ok:true, bypass:true, eventId, received_fields_keys:[...], formId}`
- Facebook network request shows `Lead` event with correct `eventID`
- Debug overlay shows success status
- Thank-you modal opens
- Console shows: `[DEV] Lead fired: <eventId>`

### 4. Submit Normal → Turnstile Verified; Make Called; Lead Fires
**Steps:**
1. Set `localStorage.setItem('vlm_cookie_consent', 'accepted')`
2. Load `/iva?dev=1` (no bypass)
3. Fill form completely
4. Complete Turnstile challenge
5. Submit form
6. Check Network tab:
   - `/api/submit` should return `{ok:true, eventId, capi:{...}}` (dev mode shows CAPI details)
   - Make webhook should be called
   - Facebook `tr` request should show `Lead` event
7. Check debug overlay: Last Submit should be "success"
8. Verify thank-you modal opens

**Expected:**
- Turnstile challenge completed
- `/api/submit` returns success
- Make webhook receives payload
- Facebook `Lead` event fires with correct `eventID`
- Thank-you modal opens

### 5. Submit 403 → Overlay Shows TURNSTILE_FAILED
**Steps:**
1. Load `/iva?dev=1`
2. Fill form
3. **Do NOT complete Turnstile** (or use invalid token)
4. Submit form
5. Check Network tab: `/api/submit` should return 403
6. Check response: `{ok:false, code:"TURNSTILE_FAILED", turnstile:{success:false, error_codes:[...]}, eventId}`
7. Check debug overlay:
   - Last Submit should be "failed"
   - Last Error should show error message
   - Backend Code should show "TURNSTILE_FAILED"

**Expected:**
- 403 response with detailed error
- Debug overlay shows failure and error code
- Console shows detailed error information
- Thank-you modal does NOT open

## Debug Overlay Fields

When `?dev=1` is present, a debug overlay appears in the bottom-right corner showing:

- **Consent**: Current consent status (`accepted`, `rejected`, `not set`)
- **Pixel Loaded**: Whether Meta Pixel script is loaded (`yes`/`no`)
- **Pixel Init**: Whether pixel is initialized (`yes`/`no`)
- **Last EventId**: Most recent eventId generated
- **Last Submit**: Submit status (`success`, `failed`, `submitting...`, `-`)
- **Last Error**: Most recent error message (if any)
- **Backend Code**: Backend error code (if any, e.g., `TURNSTILE_FAILED`)

## Environment Variables

### Backend (`netlify/functions/submit.js`)
- `DEBUG_BYPASS_KEY` - Required for bypass mode (must match `x-debug-key` header)
- `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile secret
- `MAKE_WEBHOOK_IVA_URL` - Make webhook URL for IVA form
- `MAKE_WEBHOOK_QUERY_URL` - Make webhook URL for query form
- `META_PIXEL_ID` - Meta Pixel ID (optional, for CAPI)
- `META_ACCESS_TOKEN` - Meta access token (optional, for CAPI)
- `META_TEST_EVENT_CODE` - Meta test event code (optional)

### Frontend (`iva/script.js`)
- `window.ENV.DEBUG_BYPASS_KEY` - Required for bypass mode (must match backend env var)

## Test Harness API

When `?dev=1` is present, `window.vlmDebug` is available:

```javascript
// Fire Lead event manually
vlmDebug.fireLead(eventId); // Returns {success: true/false, eventId/error}

// Check pixel status
vlmDebug.checkPixel(); // Returns {consent, pixelLoaded, pixelInitialized, fbqAvailable, fbqLoaded}

// Simulate successful submit
vlmDebug.simulateSuccess(eventId); // Fires Lead + opens thank-you modal

// Get current debug state
vlmDebug.getState(); // Returns {consent, pixelLoaded, pixelInitialized, lastEventId, lastSubmitStatus, lastError, lastBackendCode}
```

## Notes

- Production mode: No debug overlay, no verbose logging, minimal error responses
- Dev mode: Full debugging capabilities, verbose logging, detailed error responses
- Bypass mode: Only works in dev mode, requires debug key header
- Consent gating: Meta Pixel only loads after consent is accepted
- Lead deduplication: Uses `sessionStorage` to prevent duplicate Lead events
- Turnstile token: Extracted from multiple sources for reliability
- Form payload: Matches backend expected structure exactly

