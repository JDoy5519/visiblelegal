// netlify/functions/submit.js
export const config = { path: "/api/submit" };

const TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const getIp = (headers) => {
  const raw =
    headers.get("x-nf-client-connection-ip") ||
    headers.get("x-forwarded-for") ||
    headers.get("client-ip") ||
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
const digitsOnly = (v) => String(v || "").replace(/[^\d+]/g, "").trim();

const sha256hex = async (input) => {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
const isDevRequest = (req) => {
  try {
    const url = new URL(req.url);
    const sp = url.searchParams;
    return sp.get("dev") === "1" || req.headers.get("x-vlm-dev") === "1";
  } catch {
    return false;
  }
};

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
  // Your payload keys (these exist in your shown payload)
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

  // ✅ KEY CHANGE: send test_event_code whenever env var exists (even without dev=1)
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

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, message: "Method not allowed" }), { status: 405 });
  }

  const {
    TURNSTILE_SECRET_KEY,
    MAKE_WEBHOOK_IVA_URL,
    MAKE_WEBHOOK_QUERY_URL,
    MAKE_WEBHOOK_BEC_URL,
    DEBUG_BYPASS_KEY,
    META_PIXEL_ID,
    META_ACCESS_TOKEN,
    META_TEST_EVENT_CODE
  } = process.env;

  if (!TURNSTILE_SECRET_KEY || !MAKE_WEBHOOK_IVA_URL || !MAKE_WEBHOOK_QUERY_URL) {
    return new Response(JSON.stringify({ ok: false, message: "Server misconfigured" }), { status: 500 });
  }

  const url = new URL(req.url);
  const sp = url.searchParams;
  const isDev = isDevRequest(req);
  const isBypass = isDev && sp.get("bypass") === "1";

  // Bypass mode: requires debug key header
  if (isBypass) {
    const debugKey = req.headers.get("x-debug-key");
    if (!DEBUG_BYPASS_KEY) {
      return new Response(
        JSON.stringify({ ok: false, code: "BYPASS_NOT_CONFIGURED", message: "Bypass mode requires DEBUG_BYPASS_KEY env var" }),
        { status: 500 }
      );
    }
    if (debugKey !== DEBUG_BYPASS_KEY) {
      return new Response(
        JSON.stringify({ ok: false, code: "BYPASS_UNAUTHORIZED", message: "Invalid debug key" }),
        { status: 403 }
      );
    }
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    const eventId = crypto.randomUUID();
    if (isDev) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "BAD_JSON",
          message: "Invalid JSON body",
          error: String(e?.message || e),
          eventId
        }),
        { status: 400 }
      );
    }
    return new Response(JSON.stringify({ ok: false, message: "Invalid JSON body" }), { status: 400 });
  }

  const { formId, fields, turnstileToken, userAgent, sourceUrl, eventId: providedEventId } = body || {};
  const eventId = providedEventId || crypto.randomUUID();

  // Validate payload structure
  if (!formId || typeof fields !== "object") {
    if (isDev) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "BAD_PAYLOAD",
          message: "Missing formId or fields",
          expectedShape: "{formId, fields, turnstileToken, userAgent, sourceUrl, eventId}",
          gotKeys: Object.keys(body || {}),
          eventId
        }),
        { status: 400 }
      );
    }
    return new Response(JSON.stringify({ ok: false, message: "Missing formId or fields" }), { status: 400 });
  }

  const payload = {
    formId,
    fields,
    eventId,
    sourceUrl: sourceUrl || "",
    userAgent: userAgent || req.headers.get("user-agent") || "",
    received_at: new Date().toISOString(),
    client_ip: getIp(req.headers)
  };

  // Bypass mode: skip Turnstile and Make, return success
  if (isBypass) {
    return new Response(
      JSON.stringify({
        ok: true,
        bypass: true,
        eventId,
        received_fields_keys: Object.keys(fields || {}),
        formId
      }),
      { status: 200 }
    );
  }

  // Validate Turnstile token
  if (!turnstileToken) {
    if (isDev) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "MISSING_TURNSTILE",
          message: "Missing Turnstile token",
          eventId
        }),
        { status: 400 }
      );
    }
    return new Response(JSON.stringify({ ok: false, message: "Missing Turnstile token" }), { status: 400 });
  }

  // Verify Turnstile
  const verifyRes = await fetch(TURNSTILE_VERIFY, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: TURNSTILE_SECRET_KEY,
      response: turnstileToken,
      remoteip: getIp(req.headers) || ""
    })
  });

  const verifyJson = await verifyRes.json();
  if (!verifyJson.success) {
    if (isDev) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "TURNSTILE_FAILED",
          message: "Bot check failed",
          turnstile: {
            success: verifyJson.success,
            error_codes: verifyJson["error-codes"] || []
          },
          eventId
        }),
        { status: 403 }
      );
    }
    return new Response(JSON.stringify({ ok: false, message: "Bot check failed" }), { status: 403 });
  }

  const webhookUrl =
    formId === "iva-check-form"
      ? MAKE_WEBHOOK_IVA_URL
      : formId === "claimForm"
      ? MAKE_WEBHOOK_QUERY_URL
      : formId === "bec-check-form"
      ? (MAKE_WEBHOOK_BEC_URL || MAKE_WEBHOOK_QUERY_URL)
      : null;

  if (!webhookUrl) {
    if (isDev) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "UNKNOWN_FORM_ID",
          message: `Unknown form ID: ${formId}`,
          eventId
        }),
        { status: 400 }
      );
    }
    return new Response(JSON.stringify({ ok: false, message: `Unknown form ID: ${formId}` }), { status: 400 });
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
        return new Response(
          JSON.stringify({
            ok: false,
            code: "MAKE_UPSTREAM",
            message: "Upstream error",
            status: resp.status,
            textSnippet,
            eventId
          }),
          { status: 502 }
        );
      }
      return new Response(JSON.stringify({ ok: false, message: "Upstream error" }), { status: 502 });
    }

    // 2) Then Meta CAPI (best-effort)
    let capi = null;

    if (META_PIXEL_ID && META_ACCESS_TOKEN) {
      try {
        capi = await sendMetaCapiLead({
          pixelId: META_PIXEL_ID,
          accessToken: META_ACCESS_TOKEN,
          testEventCode: META_TEST_EVENT_CODE || null, // ✅ always included if set
          eventId: payload.eventId,
          sourceUrl: payload.sourceUrl,
          clientIp: payload.client_ip,
          userAgent: payload.userAgent,
          fields: payload.fields,
          cookieHeader: req.headers.get("cookie") || ""
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
    return new Response(JSON.stringify(responseData), { status: 200 });
  } catch (err) {
    clearTimeout(timer);
    const message = err?.name === "AbortError" ? "Upstream timeout" : err?.message || "Network error";
    if (isDev) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "NETWORK_ERROR",
          message,
          error: String(err?.message || err),
          eventId: payload.eventId
        }),
        { status: 504 }
      );
    }
    return new Response(JSON.stringify({ ok: false, message }), { status: 504 });
  }
};
