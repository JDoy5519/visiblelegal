/* ==========================================================================
   Cookie Consent — Visible Legal Marketing
   Manages the cookie banner and conditional loading of analytics scripts.
   ========================================================================== */

(function () {
  'use strict';

  var CONSENT_KEY = 'vlm_cookie_consent';
  var CONSENT_TTL = 365; // days

  /* ---- helpers ---- */

  function getConsent() {
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      // Check expiry
      if (data.expires && Date.now() > data.expires) {
        localStorage.removeItem(CONSENT_KEY);
        return null;
      }
      return data.value; // 'accepted' | 'rejected'
    } catch (e) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      var data = {
        value: value,
        expires: Date.now() + (CONSENT_TTL * 24 * 60 * 60 * 1000)
      };
      localStorage.setItem(CONSENT_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable */ }
  }

  function clearConsent() {
    try { localStorage.removeItem(CONSENT_KEY); } catch (e) {}
  }

  /* ---- banner visibility ---- */

  function showBanner() {
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;
    // Small delay so the slide-up animation is visible
    banner.style.display = '';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.classList.add('is-visible');
      });
    });
  }

  function hideBanner() {
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;
    banner.classList.remove('is-visible');
    // After transition, hide completely
    setTimeout(function () {
      banner.style.display = 'none';
    }, 450);
  }

  /* ---- analytics loading ---- */

  function loadAnalytics() {
    if (window.VLM && window.VLM.initAnalytics) {
      window.VLM.initAnalytics();
    }
  }

  /* ---- event handlers ---- */

  function onAccept() {
    setConsent('accepted');
    hideBanner();
    loadAnalytics();
  }

  function onReject() {
    setConsent('rejected');
    hideBanner();
  }

  /* ---- public: reopen banner ---- */

  window.vlmChangeCookieSettings = function () {
    clearConsent();
    showBanner();
  };

  /* ---- init ---- */

  function init() {
    var consent = getConsent();

    // Wire up banner buttons
    var acceptBtn = document.getElementById('cookie-accept');
    var rejectBtn = document.getElementById('cookie-reject');
    if (acceptBtn) acceptBtn.addEventListener('click', onAccept);
    if (rejectBtn) rejectBtn.addEventListener('click', onReject);

    // Wire up "change cookie settings" buttons anywhere on the page
    var changeButtons = document.querySelectorAll('[data-cookie-settings]');
    for (var i = 0; i < changeButtons.length; i++) {
      changeButtons[i].addEventListener('click', function (e) {
        e.preventDefault();
        window.vlmChangeCookieSettings();
      });
    }

    if (consent === 'accepted') {
      // User already consented — load analytics, keep banner hidden
      loadAnalytics();
    } else if (consent === 'rejected') {
      // User already rejected — keep banner hidden
    } else {
      // No choice yet — show banner
      showBanner();
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
