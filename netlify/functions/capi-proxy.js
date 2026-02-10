// netlify/functions/capi-proxy.js
const WEBHOOK_URL = process.env.MAKE_CAPI_WEBHOOK_URL;

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Allow": "POST" },
      body: "Method Not Allowed",
    };
  }

  if (!WEBHOOK_URL) {
    console.error("[CAPI PROXY] Missing MAKE_CAPI_WEBHOOK_URL env var");
    return {
      statusCode: 500,
      body: "Server misconfigured",
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    console.warn("[CAPI PROXY] Invalid JSON body:", err);
    return {
      statusCode: 400,
      body: "Invalid JSON",
    };
  }

  if (!payload || typeof payload !== "object") {
    return { statusCode: 400, body: "Missing payload" };
  }

  // Basic sanity checks to avoid totally useless spam (keep this simple for now)
  // Check if payload has data array with user_data
  const dataArray = payload.data || [];
  if (dataArray.length === 0) {
    console.warn("[CAPI PROXY] Dropping request with no data array");
    return { statusCode: 400, body: "Missing data array" };
  }

  const firstEvent = dataArray[0];
  const user = firstEvent?.user_data || {};
  if (!user.em && !user.ph && !user.fbp && !user.fbc) {
    console.warn("[CAPI PROXY] Dropping request with no user identifiers");
    return { statusCode: 400, body: "Missing user identifiers" };
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("[CAPI PROXY] Webhook error:", res.status, text);
      return {
        statusCode: res.status,
        body: text || "Webhook error",
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("[CAPI PROXY] Exception calling webhook:", err);
    return {
      statusCode: 502,
      body: "Upstream error",
    };
  }
};

