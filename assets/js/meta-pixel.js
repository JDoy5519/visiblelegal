/**
 * meta-pixel.js — VLM Meta Pixel + browser-side Lead tracking
 * Works in tandem with server-side CAPI in submit.js (deduplication via eventId)
 * Only initialises after cookie consent is granted.
 */
(function () {
  'use strict';

  var PIXEL_ID = '1540687500679034';
  var CONSENT_KEY = 'vlm_cookie_consent';
  var SESSION_EVENT_ID_KEY = 'vlm_lead_eid';
  var SESSION_FIRED_KEY = 'vlm_lead_fired';

  // ── Pixel bootstrap ───────────────────────────────────────────────────────
  function initPixel() {
    if (window.fbq) return;
    !function(f,b,e,v,n,t,s){
      if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)
    }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
    console.debug('[VLM Pixel] Initialised, PageView fired');
  }

  // ── Event ID (stable per session) ────────────────────────────────────────
  function getEventId() {
    try {
      var id = sessionStorage.getItem(SESSION_EVENT_ID_KEY);
      if (!id) {
        id = 'vlm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
        sessionStorage.setItem(SESSION_EVENT_ID_KEY, id);
      }
      return id;
    } catch(e) {
      return 'vlm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    }
  }

  function hasLeadFired() {
    try { return sessionStorage.getItem(SESSION_FIRED_KEY) === '1'; } catch(e) { return false; }
  }

  function markLeadFired() {
    try { sessionStorage.setItem(SESSION_FIRED_KEY, '1'); } catch(e) {}
  }

  // ── Browser-side Lead fire ────────────────────────────────────────────────
  function fireLeadPixel(eventId) {
    if (!window.fbq) { console.debug('[VLM Pixel] fbq not ready, skipping browser Lead'); return; }
    if (hasLeadFired()) { console.debug('[VLM Pixel] Lead already fired this session'); return; }
    fbq('track', 'Lead', {}, { eventID: eventId });
    markLeadFired();
    console.debug('[VLM Pixel] Lead fired (browser)', eventId);
  }

  // ── Consent check ─────────────────────────────────────────────────────────
  function hasConsent() {
    try { return localStorage.getItem(CONSENT_KEY) === 'accepted'; } catch(e) { return false; }
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.VLMPixel = {
    /** Call from cookies.js when user accepts analytics */
    onConsentGranted: function() {
      initPixel();
    },

    /** Returns the eventId to include in the CAPI payload */
    getEventId: getEventId,

    /**
     * Call on successful form submission.
     * Fires browser pixel Lead and returns the eventId for the server CAPI call.
     */
    trackLead: function() {
      var id = getEventId();
      if (!window.fbq && hasConsent()) {
        // Pixel not loaded yet but consent exists — init now then fire
        initPixel();
        setTimeout(function() { fireLeadPixel(id); }, 300);
      } else {
        fireLeadPixel(id);
      }
      return id;
    },

    /** Reset session flags (call if page reuses form without reload) */
    reset: function() {
      try {
        sessionStorage.removeItem(SESSION_EVENT_ID_KEY);
        sessionStorage.removeItem(SESSION_FIRED_KEY);
      } catch(e) {}
    }
  };

  // Auto-init if consent already given (returning visitor)
  if (hasConsent()) {
    initPixel();
  }

})();
