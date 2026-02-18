const https = require('https');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse form data
    let data;
    if (event.headers['content-type'] && event.headers['content-type'].includes('application/json')) {
      data = JSON.parse(event.body);
    } else {
      // Parse URL encoded data
      const params = new URLSearchParams(event.body);
      data = Object.fromEntries(params);
    }

    // Check if data is nested in a fields object
    if (data.fields) {
      console.log('[INFO] Data is nested in fields object, extracting...');

      // Preserve top-level fields before extracting
      const turnstileToken = data.turnstileToken || data['cf-turnstile-response'];
      const formId = data.formId;
      const sourceUrl = data.sourceUrl;
      const userAgent = data.userAgent;
      const eventId = data.eventId;

      // Extract nested fields
      data = data.fields;

      // Restore top-level fields
      if (turnstileToken) data['cf-turnstile-response'] = turnstileToken;
      if (formId) data.formId = formId;
      if (sourceUrl) data.source_url = sourceUrl;
      if (userAgent) data.user_agent = userAgent;
      if (eventId) data.eventId = eventId;
    }

    // Honeypot check
    if (data.company_website && data.company_website.trim() !== '') {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Invalid submission' })
      };
    }

    // Time trap check (5 seconds minimum)
    const formStartedAt = parseInt(data.form_started_at);
    const now = Date.now();
    if (!formStartedAt || (now - formStartedAt) < 5000) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Please take a few seconds to complete the form' })
      };
    }

    // Turnstile verification (if secret key is available)
    const turnstileToken = data['cf-turnstile-response'] || data.turnstileToken;
    console.log('[DEBUG] Turnstile token present:', !!turnstileToken);

    if (process.env.TURNSTILE_SECRET_KEY && turnstileToken) {
      try {
        const turnstileResponse = await verifyTurnstile(turnstileToken, event.headers['x-forwarded-for'] || event.headers['x-real-ip']);
        if (!turnstileResponse.success) {
          return {
            statusCode: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ok: false, error: 'Security check failed. Please retry the security check and submit again.' })
          };
        }
      } catch (error) {
        console.error('Turnstile verification error:', error);
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ok: false, error: 'Security check failed. Please retry the security check and submit again.' })
        };
      }
    }

    // Basic validation
    const errors = validateFormData(data);
    if (errors.length > 0) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ errors })
      };
    }

    // Check if webhook URL is configured
    if (!process.env.MAKE_WEBHOOK_IVA_URL) {
      console.error('MAKE_WEBHOOK_IVA_URL not configured');
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Service configuration error' })
      };
    }

    // Determine clean display name for IVA provider
    let ivaProviderDisplay;
    if (data.ivaProvider === 'Other') {
      // User selected "Other" - use their custom input
      ivaProviderDisplay = data.otherProvider
        ? formatProviderName(data.otherProvider.trim())
        : 'Unknown Provider';
    } else if (data.ivaProvider) {
      // Known provider - format the camelCase name
      ivaProviderDisplay = formatProviderName(data.ivaProvider);
    } else {
      ivaProviderDisplay = null;
    }

    // Format phone number to E.164 format (+44)
    let phoneE164 = null;
    if (data.phone_local) {
      const phone = data.phone_local.replace(/\s/g, '');
      if (phone.startsWith('07')) {
        phoneE164 = '+44' + phone.substring(1);
      } else if (phone.startsWith('01') || phone.startsWith('02')) {
        phoneE164 = '+44' + phone.substring(1);
      } else if (phone.startsWith('+44')) {
        phoneE164 = phone;
      } else if (phone.startsWith('44')) {
        phoneE164 = '+' + phone;
      } else {
        phoneE164 = phone;
      }
    }

    // Format DOB to DD/MM/YYYY (European format)
    // Accepts both DD/MM/YYYY (from text input) and YYYY-MM-DD (ISO from conversion)
    let dobFormatted = null;
    if (data.dob) {
      const ddmmMatch = data.dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const isoMatch = data.dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ddmmMatch) {
        dobFormatted = data.dob; // Already in DD/MM/YYYY
      } else if (isoMatch) {
        dobFormatted = `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`; // Convert ISO to DD/MM/YYYY
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

    // Build sanitized payload
    const payload = {
      name: sanitizeString(data.fullName),
      email: data.email.toLowerCase().trim(),
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
      source_url: data.source_url || null,
      submitted_at: new Date().toISOString()
    };

    // Send to webhook
    const webhookResult = await sendToWebhook(process.env.MAKE_WEBHOOK_IVA_URL, payload);
    
    if (!webhookResult.success) {
      return {
        statusCode: 502,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Failed to process submission', details: webhookResult.data, statusCode: webhookResult.statusCode })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ok: true, success: true, message: 'Form submitted successfully' })
    };

  } catch (error) {
    console.error('Error processing form submission:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Internal server error', details: error.message, stack: error.stack })
    };
  }
};

// Helper functions
function formatProviderName(name) {
  if (!name) return null;

  // Split camelCase into separate words
  // e.g., "DebtMovement" -> "Debt Movement"
  // "HarringtonBrooks" -> "Harrington Brooks"
  const withSpaces = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');

  // Capitalize each word and trim
  const formatted = withSpaces
    .split(' ')
    .map(word => word.trim())
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return formatted;
}

function validateFormData(data) {
  const errors = [];
  
  // Name validation
  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  } else if (containsUrl(data.fullName)) {
    errors.push('Name cannot contain URLs');
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    errors.push('Valid email address is required');
  }
  
  // Phone validation (if provided)
  if (data.phone_local) {
    const phoneRegex = /^(\+44|0)[1-9]\d{8,9}$/;
    if (!phoneRegex.test(data.phone_local.replace(/\s/g, ''))) {
      errors.push('Valid UK phone number is required');
    }
  }
  
  // Postcode validation (if provided)
  if (data.postcode) {
    const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
    if (!postcodeRegex.test(data.postcode.replace(/\s/g, ''))) {
      errors.push('Valid UK postcode is required');
    }
  }
  
  // Spam word check
  const spamWords = /viagra|cialis|porn|seo|crypto/i;
  const fullText = `${data.fullName} ${data.email} ${data.notes || ''}`;
  if (spamWords.test(fullText)) {
    errors.push('Submission contains inappropriate content');
  }
  
  return errors;
}

function sanitizeString(str) {
  if (!str) return null;
  return str.trim().replace(/[<>\"'&]/g, '');
}

function containsUrl(text) {
  const urlRegex = /(https?:\/\/|www\.)[^\s]+/i;
  return urlRegex.test(text);
}

async function verifyTurnstile(token, ip) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  const formData = new URLSearchParams();
  formData.append('secret', secretKey);
  formData.append('response', token);
  formData.append('remoteip', ip);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'challenges.cloudflare.com',
      port: 443,
      path: '/turnstile/v0/siteverify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formData.toString())
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(formData.toString());
    req.end();
  });
}

async function sendToWebhook(url, payload) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: options.headers
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
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
