const https = require('https');

// =============================================
// In-memory rate limiting (per serverless instance)
// =============================================
const rateLimit = new Map();
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_MAX = 5; // max submissions per key per window

function isRateLimited(key) {
  if (!key) return false;
  const now = Date.now();
  const entry = rateLimit.get(key);
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateLimit.set(key, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_MAX;
}

// Behavioral score thresholds for IVA form (stricter — more fields)
const BEHAVIOR_THRESHOLDS = {
  minInteractions: 6,
  minKeystrokes: 12,
  minFieldFocuses: 3,
  minTimeOnPage: 20,
  maxPasteRatio: 0.7,
  minFormChanges: 4
};

function validateBehavior(score) {
  if (!score) return { pass: false, reason: 'No behavioral data' };

  const fails = [];
  if (score.interactions < BEHAVIOR_THRESHOLDS.minInteractions) fails.push('interactions');
  if (score.keystrokes < BEHAVIOR_THRESHOLDS.minKeystrokes) fails.push('keystrokes');
  if (score.fieldFocuses < BEHAVIOR_THRESHOLDS.minFieldFocuses) fails.push('fieldFocuses');
  if (score.timeOnPage < BEHAVIOR_THRESHOLDS.minTimeOnPage) fails.push('timeOnPage');
  if (score.pasteRatio > BEHAVIOR_THRESHOLDS.maxPasteRatio) fails.push('pasteRatio');
  if (score.formChanges < BEHAVIOR_THRESHOLDS.minFormChanges) fails.push('formChanges');

  const pass = fails.length <= 1; // Allow 1 marginal fail
  return { pass, fails, score };
}

exports.handler = async (event, context) => {
  const HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ ok: false, error: 'Method not allowed' })
    };
  }

  try {
    // Parse form data
    let rawData;
    if (event.headers['content-type'] && event.headers['content-type'].includes('application/json')) {
      rawData = JSON.parse(event.body);
    } else {
      const params = new URLSearchParams(event.body);
      rawData = Object.fromEntries(params);
    }

    // forms.js sends { formId, fields, behaviorScore, sourceUrl, userAgent, eventId }
    const data = rawData.fields || rawData;
    const behaviorScore = rawData.behaviorScore || null;
    const sourceUrl = rawData.sourceUrl || data.source_url || event.headers.referer || null;
    const userAgent = rawData.userAgent || event.headers['user-agent'] || null;
    const ip = event.headers['x-forwarded-for'] || event.headers['x-nf-client-connection-ip'] || event.headers['x-real-ip'] || null;

    // ---- Honeypot check ----
    if (data.company_website && data.company_website.trim() !== '') {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, error: 'Invalid submission' })
      };
    }

    // ---- Time trap check (5 seconds minimum) ----
    const formStartedAt = parseInt(data.form_started_at);
    const now = Date.now();
    if (!formStartedAt || (now - formStartedAt) < 5000) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, error: 'Please take a few seconds to complete the form' })
      };
    }

    // ---- Behavioral validation ----
    const behaviorResult = validateBehavior(behaviorScore);
    console.log('[IVA] Behavioral validation:', JSON.stringify(behaviorResult));
    if (!behaviorResult.pass) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, error: 'Please complete the form naturally before submitting.' })
      };
    }

    // ---- Rate limiting (IP, email, phone) ----
    const email = (data.email || '').toLowerCase().trim();
    const phone = (data.phone_local || '').replace(/\s/g, '');
    const rateLimitKeys = [
      ip ? `iva:ip:${ip}` : null,
      email ? `iva:email:${email}` : null,
      phone ? `iva:phone:${phone}` : null
    ].filter(Boolean);

    for (const key of rateLimitKeys) {
      if (isRateLimited(key)) {
        console.warn('[IVA] Rate limited:', key);
        return {
          statusCode: 429,
          headers: HEADERS,
          body: JSON.stringify({ ok: false, error: 'Too many submissions. Please try again later.' })
        };
      }
    }

    // ---- Basic validation ----
    const errors = validateFormData(data);
    if (errors.length > 0) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, error: errors[0], errors })
      };
    }

    // ---- Check if webhook URL is configured ----
    if (!process.env.MAKE_WEBHOOK_IVA_URL) {
      console.error('MAKE_WEBHOOK_IVA_URL not configured');
      return {
        statusCode: 500,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, error: 'Service configuration error' })
      };
    }

    // ---- Determine clean display name for IVA provider ----
    let ivaProviderDisplay;
    if (data.ivaProvider === 'Other') {
      ivaProviderDisplay = data.otherProvider
        ? formatProviderName(data.otherProvider.trim())
        : 'Unknown Provider';
    } else if (data.ivaProvider) {
      ivaProviderDisplay = formatProviderName(data.ivaProvider);
    } else {
      ivaProviderDisplay = null;
    }

    // ---- Format phone number to E.164 format (+44) ----
    let phoneE164 = null;
    if (data.phone_local) {
      const ph = data.phone_local.replace(/\s/g, '');
      if (ph.startsWith('07') || ph.startsWith('01') || ph.startsWith('02')) {
        phoneE164 = '+44' + ph.substring(1);
      } else if (ph.startsWith('+44')) {
        phoneE164 = ph;
      } else if (ph.startsWith('44')) {
        phoneE164 = '+' + ph;
      } else {
        phoneE164 = ph;
      }
    }

    // ---- Format DOB to DD/MM/YYYY ----
    // Accepts both DD/MM/YYYY (from text input) and YYYY-MM-DD (ISO from conversion)
    let dobFormatted = null;
    if (data.dob) {
      const ddmmMatch = data.dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const isoMatch = data.dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ddmmMatch) {
        dobFormatted = data.dob;
      } else if (isoMatch) {
        dobFormatted = `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
      } else {
        const dobDate = new Date(data.dob);
        if (!isNaN(dobDate)) {
          const day = String(dobDate.getDate()).padStart(2, '0');
          const month = String(dobDate.getMonth() + 1).padStart(2, '0');
          const year = dobDate.getFullYear();
          dobFormatted = `${day}/${month}/${year}`;
        }
      }
    }

    // ---- Build sanitized payload ----
    const payload = {
      name: sanitizeString(data.fullName),
      email: email,
      phone: phoneE164,
      postcode: data.postcode || null,
      city: data.city || null,
      current_address: data.currentAddress || null,
      dob: dobFormatted,
      iva_provider: data.ivaProvider || null,
      other_provider: data.otherProvider || null,
      iva_provider_display: ivaProviderDisplay,
      iva_ref: data.ivaRef || null,
      iva_status: data.ivaStatus || null,
      payment_affordable: data.paymentAffordable || null,
      warned_of_risks: data.warnedOfRisks || null,
      sales_approach: data.salesApproach || null,
      consent_given: data.consentGiven || null,
      notes: data.notes || null,
      uploads_opt_in: data.uploads_opt_in || null,
      source_url: sourceUrl,
      submitted_at: new Date().toISOString()
    };

    // ---- Send to webhook ----
    console.log('IVA claim submitted:', { name: payload.name, email: payload.email });
    const webhookResult = await sendToWebhook(process.env.MAKE_WEBHOOK_IVA_URL, payload);

    if (!webhookResult.success) {
      console.error('Make.com webhook failed:', { status: webhookResult.statusCode });
      return {
        statusCode: 502,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, error: 'Failed to process submission. Please try again.' })
      };
    }

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ ok: true, message: 'Form submitted successfully' })
    };

  } catch (error) {
    console.error('IVA submission error:', error);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ ok: false, error: 'Internal server error' })
    };
  }
};


// =============================================
// Helpers
// =============================================

function formatProviderName(name) {
  if (!name) return null;
  const withSpaces = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
  return withSpaces
    .split(' ')
    .map(word => word.trim())
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function validateFormData(data) {
  const errors = [];

  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  } else if (containsUrl(data.fullName)) {
    errors.push('Name cannot contain URLs');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    errors.push('Valid email address is required');
  }

  if (data.phone_local) {
    const phoneRegex = /^(\+44|0)[1-9]\d{8,9}$/;
    if (!phoneRegex.test(data.phone_local.replace(/\s/g, ''))) {
      errors.push('Valid UK phone number is required');
    }
  }

  if (data.postcode) {
    const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
    if (!postcodeRegex.test(data.postcode.replace(/\s/g, ''))) {
      errors.push('Valid UK postcode is required');
    }
  }

  const spamWords = /viagra|cialis|porn|seo|crypto/i;
  const fullText = `${data.fullName} ${data.email} ${data.notes || ''}`;
  if (spamWords.test(fullText)) {
    errors.push('Submission contains inappropriate content');
  }

  return errors;
}

function sanitizeString(str) {
  if (!str) return null;
  return str.trim().replace(/[<>"'&]/g, '');
}

function containsUrl(text) {
  return /(https?:\/\/|www\.)[^\s]+/i.test(text || '');
}

async function sendToWebhook(url, payload) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);
    const urlObj = new URL(url);

    const req = https.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ success: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, data });
      });
    });

    req.on('error', (error) => {
      console.error('Webhook request error:', error);
      resolve({ success: false, error });
    });

    req.write(postData);
    req.end();
  });
}
