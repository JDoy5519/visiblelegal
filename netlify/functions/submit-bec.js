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

// Behavioral score thresholds for BEC form
const BEHAVIOR_THRESHOLDS = {
  minInteractions: 5,
  minKeystrokes: 8,
  minFieldFocuses: 2,
  minTimeOnPage: 12,
  maxPasteRatio: 0.8,
  minFormChanges: 3
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

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ ok: false, message: 'Method not allowed' })
    };
  }

  try {
    const raw = JSON.parse(event.body);

    // forms.js sends { formId, fields, behaviorScore, sourceUrl, userAgent, eventId }
    const fields = raw.fields || raw;
    const behaviorScore = raw.behaviorScore || null;
    const sourceUrl = raw.sourceUrl || fields.source_url || event.headers.referer || null;
    const userAgent = raw.userAgent || event.headers['user-agent'] || null;
    const ip = event.headers['x-forwarded-for'] || event.headers['x-nf-client-connection-ip'] || event.headers['x-real-ip'] || null;

    // ---- Honeypot check ----
    if (fields.company_website && fields.company_website.trim() !== '') {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, message: 'Invalid submission' })
      };
    }

    // ---- Time trap (5s minimum) ----
    const formStartedAt = parseInt(fields.form_started_at);
    const now = Date.now();
    if (!formStartedAt || (now - formStartedAt) < 5000) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, message: 'Please take a moment to complete the form.' })
      };
    }

    // ---- Behavioral validation ----
    const behaviorResult = validateBehavior(behaviorScore);
    console.log('[BEC] Behavioral validation:', JSON.stringify(behaviorResult));
    if (!behaviorResult.pass) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, message: 'Please complete the form naturally before submitting.' })
      };
    }

    // ---- Rate limiting ----
    const email = (fields.email || '').toLowerCase().trim();
    const rateLimitKey = `bec:${ip || email}`;
    if (isRateLimited(rateLimitKey)) {
      console.warn('[BEC] Rate limited:', rateLimitKey);
      return {
        statusCode: 429,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, message: 'Too many submissions. Please try again later.' })
      };
    }

    // ---- Validate required fields ----
    const errors = validateFormData(fields);
    if (errors.length > 0) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, message: errors[0], errors })
      };
    }

    // ---- Check webhook URL ----
    if (!process.env.MAKE_WEBHOOK_BEC_URL) {
      console.error('MAKE_WEBHOOK_BEC_URL not configured');
      return {
        statusCode: 500,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, message: 'Service configuration error. Please try again later.' })
      };
    }

    // ---- Build sanitised payload for Make.com ----
    const payload = {
      // Contact
      contact_name: sanitize(fields.contactName),
      contact_position: sanitize(fields.contactPosition),
      email: email,
      phone: fields.phone_local || fields.phone_e164 || null,
      preferred_contact: fields.preferredContact || null,
      // Company
      company_name: sanitize(fields.companyName),
      company_number: fields.companyNumber || null,
      industry_sector: fields.industrySector || null,
      employee_count: fields.employeeCount || null,
      // Address
      address_line1: sanitize(fields.addressLine1),
      address_line2: sanitize(fields.addressLine2),
      city: sanitize(fields.city),
      county: sanitize(fields.county),
      postcode: (fields.postcode || '').toUpperCase().trim() || null,
      // BEC claim details
      used_broker: fields.usedBroker || null,
      broker_name: sanitize(fields.brokerName),
      annual_energy_spend: fields.annualEnergySpend || null,
      commission_disclosed: fields.commissionDisclosed || null,
      // Consent
      privacy_consent: fields.privacyConsent || null,
      // Metadata
      source_url: sourceUrl,
      user_agent: userAgent,
      ip: ip,
      submitted_at: new Date().toISOString()
    };

    // ---- Forward to Make.com ----
    console.log('BEC claim submitted:', { company: payload.company_name, email: payload.email });

    const webhookResult = await sendToWebhook(process.env.MAKE_WEBHOOK_BEC_URL, payload);

    if (!webhookResult.success) {
      console.error('Make.com webhook failed:', { status: webhookResult.statusCode });
      return {
        statusCode: 502,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, message: 'Failed to process your claim. Please try again.' })
      };
    }

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ ok: true, message: 'Your business energy claim has been submitted successfully.' })
    };

  } catch (error) {
    console.error('BEC submission error:', error);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ ok: false, message: 'An error occurred. Please try again or email support@visiblelegal.co.uk' })
    };
  }
};


// =============================================
// Helpers
// =============================================

function validateFormData(d) {
  const errors = [];

  if (!d.companyName || d.companyName.trim().length < 2) {
    errors.push('Company name is required');
  } else if (containsUrl(d.companyName)) {
    errors.push('Company name cannot contain URLs');
  }

  if (!d.contactName || d.contactName.trim().length < 2) {
    errors.push('Contact name is required');
  } else if (containsUrl(d.contactName)) {
    errors.push('Contact name cannot contain URLs');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!d.email || !emailRegex.test(d.email)) {
    errors.push('Valid email address is required');
  }

  if (d.phone_local) {
    const phoneClean = (d.phone_local || '').replace(/\s/g, '');
    const phoneRegex = /^(\+44|0)[1-9]\d{8,9}$/;
    if (!phoneRegex.test(phoneClean)) {
      errors.push('Valid UK phone number is required');
    }
  }

  if (d.postcode) {
    const pcClean = (d.postcode || '').replace(/\s/g, '');
    const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/i;
    if (!postcodeRegex.test(pcClean)) {
      errors.push('Valid UK postcode is required');
    }
  }

  // Spam check
  const spamWords = /viagra|cialis|porn|seo|crypto/i;
  const text = `${d.companyName || ''} ${d.contactName || ''} ${d.email || ''} ${d.additionalNotes || ''}`;
  if (spamWords.test(text)) {
    errors.push('Submission contains inappropriate content');
  }

  return errors;
}

function sanitize(str) {
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
      port: urlObj.port || 443,
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
