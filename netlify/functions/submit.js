// netlify/functions/submit.js
const { createHash } = require('crypto');

const getIp = (headers) => {
  const raw =
    headers["x-nf-client-connection-ip"] ||
    headers["x-forwarded-for"] ||
    headers["client-ip"] ||
    "";

  // x-forwarded-for can be "ip, proxy1, proxy2"
  const first = raw.split(",")[0].trim();
  return first || null;
};

const getCookieValue = (cookieHeader, name) => {
  try {
    if (!cookieHeader) return null;
    const parts = cookieHeader.split(";").map((p) => p.trim());
    for (const p of parts) {
      if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
    }
    return null;
  } catch {
    return null;
  }
};

const normalize = (v) => String(v || "").trim().toLowerCase();
const digitsOnly = (v) => String(v || "").replace(/[^\d]/g, "").trim();

const sha256hex = async (input) => {
  return createHash('sha256').update(input).digest('hex');
};

const pickFirst = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
};

const buildFbcFromFbclid = (fbclid) => {
  try {
    if (!fbclid) return null;
    const ts = Math.floor(Date.now() / 1000);
    return `fb.1.${ts}.${fbclid}`;
  } catch {
    return null;
  }
};

// Dev mode detection helper
const isDevRequest = (event) => {
  try {
    const sp = event.queryStringParameters || {};
    return sp.dev === "1" || (event.headers["x-vlm-dev"] === "1");
  } catch {
    return false;
  }
};

// Behavioral validation
const BEHAVIOR_THRESHOLDS = {
  minInteractions: 4,
  minKeystrokes: 6,
  minFieldFocuses: 2,
  minTimeOnPage: 8,
  maxPasteRatio: 0.85,
  minFormChanges: 2
};

function validateBehavior(score) {
  if (!score) return { pass: false, reason: "No behavioral data" };

  const fails = [];
  if (score.interactions < BEHAVIOR_THRESHOLDS.minInteractions) fails.push("interactions");
  if (score.keystrokes < BEHAVIOR_THRESHOLDS.minKeystrokes) fails.push("keystrokes");
  if (score.fieldFocuses < BEHAVIOR_THRESHOLDS.minFieldFocuses) fails.push("fieldFocuses");
  if (score.timeOnPage < BEHAVIOR_THRESHOLDS.minTimeOnPage) fails.push("timeOnPage");
  if (score.pasteRatio > BEHAVIOR_THRESHOLDS.maxPasteRatio) fails.push("pasteRatio");
  if (score.formChanges < BEHAVIOR_THRESHOLDS.minFormChanges) fails.push("formChanges");

  const pass = fails.length <= 1;
  return { pass, fails, score };
}

// In-memory rate limiting
const rateLimit = new Map();
const RATE_WINDOW = 60 * 60 * 1000;
const RATE_MAX = 5;

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

async function sendMetaCapiLead({
  pixelId,
  accessToken,
  testEventCode,
  eventId,
  sourceUrl,
  clientIp,
  userAgent,
  fields,
  cookieHeader
}) {
  const emailRaw = pickFirst(fields, ["email", "emailAddress", "userEmail"]);
  const phoneRaw = pickFirst(fields, ["phone_e164", "phone", "mobile", "phoneNumber", "phone_local"]);

  const email = emailRaw ? normalize(emailRaw) : null;
  const phone = phoneRaw ? digitsOnly(phoneRaw) : null;

  const fbp = getCookieValue(cookieHeader, "_fbp");
  const fbcCookie = getCookieValue(cookieHeader, "_fbc");

  let fbc = fbcCookie || null;
  if (!fbc && sourceUrl) {
    try {
      const u = new URL(sourceUrl);
      const fbclid = u.searchParams.get("fbclid");
      fbc = buildFbcFromFbclid(fbclid);
    } catch {
      // ignore
    }
  }

  const user_data = {
    client_ip_address: clientIp || undefined,
    client_user_agent: userAgent || undefined,
    fbp: fbp || undefined,
    fbc: fbc || undefined,
    em: email ? [await sha256hex(email)] : undefined,
    ph: phone ? [await sha256hex(phone)] : undefined
  };

  Object.keys(user_data).forEach((k) => user_data[k] === undefined && delete user_data[k]);

  const body = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_id: eventId,
        event_source_url: sourceUrl || undefined,
        user_data
      }
    ]
  };

  if (testEventCode) body.test_event_code = testEventCode;

  const url = `https://graph.facebook.com/v24.0/${pixelId}/events?access_token=${accessToken}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 5000);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await resp.text().catch(() => "");
    return { ok: resp.ok, status: resp.status, text };
  } finally {
    clearTimeout(t);
  }
}

const HEADERS = { "Content-Type": "application/json" };

const respond = (statusCode, data) => ({
  statusCode,
  headers: HEADERS,
  body: JSON.stringify(data)
});

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return respond(405, { ok: false, message: "Method not allowed" });
  }

  const {
    MAKE_WEBHOOK_IVA_URL,
    MAKE_WEBHOOK_QUERY_URL,
    MAKE_WEBHOOK_BEC_URL,
    DEBUG_BYPASS_KEY,
    META_PIXEL_ID,
    META_ACCESS_TOKEN,
    META_TEST_EVENT_CODE
  } = process.env;

  if (!MAKE_WEBHOOK_IVA_URL || !MAKE_WEBHOOK_QUERY_URL) {
    return respond(500, { ok: false, message: "Server misconfigured" });
  }

  const sp = event.queryStringParameters || {};
  const isDev = isDevRequest(event);
  const isBypass = isDev && sp.bypass === "1";

  // Bypass mode: requires debug key header
  if (isBypass) {
    const debugKey = event.headers["x-debug-key"];
    if (!DEBUG_BYPASS_KEY) {
      return respond(500, { ok: false, code: "BYPASS_NOT_CONFIGURED", message: "Bypass mode requires DEBUG_BYPASS_KEY env var" });
    }
    if (debugKey !== DEBUG_BYPASS_KEY) {
      return respond(403, { ok: false, code: "BYPASS_UNAUTHORIZED", message: "Invalid debug key" });
    }
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    const eventId = crypto.randomUUID();
    if (isDev) {
      return respond(400, {
        ok: false,
        code: "BAD_JSON",
        message: "Invalid JSON body",
        error: String(e?.message || e),
        eventId
      });
    }
    return respond(400, { ok: false, message: "Invalid JSON body" });
  }

  const { formId, fields, behaviorScore, userAgent, sourceUrl, eventId: providedEventId } = body || {};
  const eventId = providedEventId || crypto.randomUUID();

  // Validate payload structure
  if (!formId || typeof fields !== "object") {
    if (isDev) {
      return respond(400, {
        ok: false,
        code: "BAD_PAYLOAD",
        message: "Missing formId or fields",
        expectedShape: "{formId, fields, behaviorScore, userAgent, sourceUrl, eventId}",
        gotKeys: Object.keys(body || {}),
        eventId
      });
    }
    return respond(400, { ok: false, message: "Missing formId or fields" });
  }

  const clientIp = getIp(event.headers);

  const payload = {
    formId,
    fields,
    eventId,
    sourceUrl: sourceUrl || "",
    userAgent: userAgent || event.headers["user-agent"] || "",
    received_at: new Date().toISOString(),
    client_ip: clientIp
  };

  // Bypass mode: skip validation and Make, return success
  if (isBypass) {
    return respond(200, {
      ok: true,
      bypass: true,
      eventId,
      received_fields_keys: Object.keys(fields || {}),
      formId
    });
  }

  // ---- Behavioral validation ----
  const behaviorResult = validateBehavior(behaviorScore);
  if (!behaviorResult.pass) {
    if (isDev) {
      return respond(400, {
        ok: false,
        code: "BEHAVIOR_FAILED",
        message: "Behavioral check failed",
        behaviorResult,
        eventId
      });
    }
    return respond(400, { ok: false, message: "Please complete the form naturally before submitting." });
  }

  // ---- Rate limiting ----
  const rateLimitKey = clientIp ? `submit:${clientIp}` : null;
  if (isRateLimited(rateLimitKey)) {
    return respond(429, { ok: false, message: "Too many submissions. Please try again later." });
  }

  // Map form IDs to webhook URLs
  const webhookUrl =
    formId === "iva-claim-form"
      ? MAKE_WEBHOOK_IVA_URL
      : formId === "claimForm"
      ? MAKE_WEBHOOK_QUERY_URL
      : formId === "bec-claim-form"
      ? (MAKE_WEBHOOK_BEC_URL || MAKE_WEBHOOK_QUERY_URL)
      : null;

  if (!webhookUrl) {
    if (isDev) {
      return respond(400, {
        ok: false,
        code: "UNKNOWN_FORM_ID",
        message: `Unknown form ID: ${formId}`,
        eventId
      });
    }
    return respond(400, { ok: false, message: `Unknown form ID: ${formId}` });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    // 1) Send to Make first
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      const textSnippet = text.length > 200 ? text.slice(0, 200) + "..." : text;
      if (isDev) {
        return respond(502, {
          ok: false,
          code: "MAKE_UPSTREAM",
          message: "Upstream error",
          status: resp.status,
          textSnippet,
          eventId
        });
      }
      return respond(502, { ok: false, message: "Upstream error" });
    }

    // 2) Then Meta CAPI (best-effort)
    let capi = null;

    if (META_PIXEL_ID && META_ACCESS_TOKEN) {
      try {
        capi = await sendMetaCapiLead({
          pixelId: META_PIXEL_ID,
          accessToken: META_ACCESS_TOKEN,
          testEventCode: META_TEST_EVENT_CODE || null,
          eventId: payload.eventId,
          sourceUrl: payload.sourceUrl,
          clientIp: payload.client_ip,
          userAgent: payload.userAgent,
          fields: payload.fields,
          cookieHeader: event.headers["cookie"] || ""
        });
      } catch (e) {
        capi = { ok: false, status: 0, text: String(e?.message || e) };
      }
    } else if (isDev) {
      capi = { ok: false, status: 0, text: "META_PIXEL_ID/META_ACCESS_TOKEN not set" };
    }

    // Return OK; only include capi debug details in dev mode
    const responseData = {
      ok: true,
      eventId: payload.eventId
    };
    if (isDev) {
      responseData.capi = capi;
    }
    return respond(200, responseData);
  } catch (err) {
    clearTimeout(timer);
    const message = err?.name === "AbortError" ? "Upstream timeout" : err?.message || "Network error";
    if (isDev) {
      return respond(504, {
        ok: false,
        code: "NETWORK_ERROR",
        message,
        error: String(err?.message || err),
        eventId: payload.eventId
      });
    }
    return respond(504, { ok: false, message });
  }
};
