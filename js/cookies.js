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
    // Guard: only load once
    if (window.__vlm_analytics_loaded) return;
    window.__vlm_analytics_loaded = true;

    // Google Analytics 4 — replace G-XXXXXXX with real ID when available
    // (function () {
    //   var s = document.createElement('script');
    //   s.async = true;
    //   s.src = 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX';
    //   document.head.appendChild(s);
    //   window.dataLayer = window.dataLayer || [];
    //   function gtag() { dataLayer.push(arguments); }
    //   gtag('js', new Date());
    //   gtag('config', 'G-XXXXXXX', { anonymize_ip: true });
    // })();

    // Microsoft Clarity — replace XXXXXXX with real ID when available
    // (function (c,l,a,r,i,t,y) {
    //   c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    //   t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    //   y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    // })(window,document,"clarity","script","XXXXXXX");

    // Meta Pixel — replace XXXXXXX with real ID when available
    // (function () {
    //   !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    //   n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    //   n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    //   t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    //   (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    //   fbq('init', 'XXXXXXX');
    //   fbq('track', 'PageView');
    // })();
  }

  /* ---- event handlers ---- */

  function onAccept() {
    setConsent('accepted');
    hideBanner();
    loadAnalytics();

    // Notify Meta pixel module that consent was just granted
    if (window.VLMPixel && typeof window.VLMPixel.onConsentGranted === 'function') {
      window.VLMPixel.onConsentGranted();
    }
  }

  function onReject() {
    setConsent('rejected');
    hideBanner();
  }

  /* ---- public: reopen banner ---- */

  window.vlmChangeCookieSettings = function () {
    clearConsent();
    window.__vlm_analytics_loaded = false;
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
