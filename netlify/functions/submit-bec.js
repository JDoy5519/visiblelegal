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
    if (process.env.TURNSTILE_SECRET_KEY && data['cf-turnstile-response']) {
      try {
        const turnstileResponse = await verifyTurnstile(data['cf-turnstile-response'], event.headers['x-forwarded-for'] || event.headers['x-real-ip']);
        if (!turnstileResponse.success) {
          return {
            statusCode: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Captcha verification failed' })
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
          body: JSON.stringify({ error: 'Captcha verification failed' })
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
    if (!process.env.MAKE_WEBHOOK_BEC_URL) {
      console.error('MAKE_WEBHOOK_BEC_URL not configured');
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Service configuration error' })
      };
    }

    // Build sanitized payload
    const payload = {
      // Contact details
      contact_name: sanitizeString(data.contactName),
      contact_position: sanitizeString(data.contactPosition),
      email: data.email.toLowerCase().trim(),
      phone: data.phone_local || data.phone_e164 || null,
      preferred_contact: data.preferredContact || null,
      // Company details
      company_name: sanitizeString(data.companyName),
      company_number: data.companyNumber || null,
      industry_sector: data.industrySector || null,
      employee_count: data.employeeCount || null,
      // Company address
      address_line1: sanitizeString(data.addressLine1) || null,
      address_line2: sanitizeString(data.addressLine2) || null,
      city: sanitizeString(data.city) || null,
      county: sanitizeString(data.county) || null,
      postcode: data.postcode || null,
      // BEC claim specific fields
      used_broker: data.usedBroker || null,
      broker_name: sanitizeString(data.brokerName) || null,
      contract_start_date: data.contractStartDate || null,
      contract_duration: data.contractDuration || null,
      annual_energy_spend: data.annualEnergySpend || null,
      commission_disclosed: data.commissionDisclosed || null,
      experience_checks: data.experienceChecks || null,
      additional_notes: sanitizeString(data.additionalNotes) || null,
      privacy_consent: data.privacyConsent || null,
      // Metadata
      source_url: data.source_url || event.headers.referer || null,
      user_agent: event.headers['user-agent'] || null,
      ip: event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || null,
      submitted_at: new Date().toISOString()
    };

    // Send to webhook
    const webhookResult = await sendToWebhook(process.env.MAKE_WEBHOOK_BEC_URL, payload);

    if (!webhookResult.success) {
      return {
        statusCode: 502,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Failed to process submission' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true, message: 'Form submitted successfully' })
    };

  } catch (error) {
    console.error('Error processing form submission:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

// Helper functions
function validateFormData(data) {
  const errors = [];

  // Company name validation
  if (!data.companyName || data.companyName.trim().length < 2) {
    errors.push('Company name must be at least 2 characters long');
  } else if (containsUrl(data.companyName)) {
    errors.push('Company name cannot contain URLs');
  }

  // Contact name validation
  if (!data.contactName || data.contactName.trim().length < 2) {
    errors.push('Contact name must be at least 2 characters long');
  } else if (containsUrl(data.contactName)) {
    errors.push('Contact name cannot contain URLs');
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
  const fullText = `${data.companyName} ${data.contactName} ${data.email} ${data.additionalNotes || ''}`;
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
        'Content-Length': Buffer.byteLength(formData)
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

    req.write(formData);
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
