/**
 * analytics.js — Visible Legal Marketing
 * Unified client-side tracking: Meta Pixel + Google Analytics 4.
 * Called by cookies.js after consent is granted — never auto-initialises.
 */
(function () {
  'use strict';

  var initialised = false;

  var env = window.ENV || {};
  var pixelId = env.META_PIXEL_ID || '';
  var gaId = env.GOOGLE_ANALYTICS_ID || '';

  function initPixel() {
    if (!pixelId || window.fbq) return;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', pixelId);
    fbq('track', 'PageView');
  }

  function initGA() {
    if (!gaId || window.__vlm_ga_loaded) return;
    window.__vlm_ga_loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + gaId;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', gaId, { anonymize_ip: true });
  }

  window.VLM = window.VLM || {};

  window.VLM.initAnalytics = function () {
    if (initialised) return;
    initialised = true;
    initPixel();
    initGA();
  };

  window.VLM.trackLead = function (eventId) {
    if (window.fbq && pixelId) {
      fbq('trackCustom', 'CheckEligibility', {}, { eventID: eventId });
    }
    if (window.gtag) {
      gtag('event', 'generate_lead', { event_id: eventId });
    }
  };
})();
