/* =========================================================
   VLM / IVA Landing Page — script.cleaned.js
   - DRY helpers & bindings
   - 4-step flow preserved
   - Conditional UI + validation maintained
   ========================================================= */

const qsl = new URLSearchParams(location.search);
const DEV = qsl.get('dev') === '1';
const BYPASS = DEV && qsl.get('bypass') === '1';
const MOCK = DEV && qsl.has('mock');

if (DEV) console.log('[DEV] script loaded', { DEV, BYPASS, MOCK, href: location.href });

// Environment variables
window.ENV = window.ENV || {};
window.ENV.MAKE_CAPI_WEBHOOK_URL = window.ENV.MAKE_CAPI_WEBHOOK_URL || "";
window.ENV.MAKE_IVA_CAPTURE_WEBHOOK_URL = window.ENV.MAKE_IVA_CAPTURE_WEBHOOK_URL || "";
window.ENV.MAKE_GENERAL_QUERY_WEBHOOK_URL = window.ENV.MAKE_GENERAL_QUERY_WEBHOOK_URL || "";
window.ENV.DEBUG_BYPASS_KEY = window.ENV.DEBUG_BYPASS_KEY || "";

// Debug overlay state (dev mode only)
let debugState = {
  consent: localStorage.getItem('vlm_cookie_consent') || 'not set',
  pixelLoaded: false,
  pixelInitialized: false,
  lastEventId: null,
  lastSubmitStatus: null,
  lastError: null,
  lastBackendCode: null
};

// Debug overlay (dev mode only)
if (DEV) {
  (function createDebugOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'vlm-debug-overlay';
    overlay.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.9);
      color: #0f0;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      padding: 12px;
      border-radius: 4px;
      z-index: 99999;
      max-width: 300px;
      line-height: 1.4;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    overlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; color: #0ff;">🔧 DEV MODE</div>
      <div>Consent: <span id="debug-consent">${debugState.consent}</span></div>
      <div>Pixel Loaded: <span id="debug-pixel-loaded">no</span></div>
      <div>Pixel Init: <span id="debug-pixel-init">no</span></div>
      <div>Last EventId: <span id="debug-eventid">-</span></div>
      <div>Last Submit: <span id="debug-submit">-</span></div>
      <div>Last Error: <span id="debug-error" style="color: #f00;">-</span></div>
      <div>Backend Code: <span id="debug-code">-</span></div>
    `;
    document.body.appendChild(overlay);

    function updateDebugOverlay() {
      const el = (id) => document.getElementById(id);
      if (el('debug-consent')) el('debug-consent').textContent = debugState.consent;
      if (el('debug-pixel-loaded')) el('debug-pixel-loaded').textContent = debugState.pixelLoaded ? 'yes' : 'no';
      if (el('debug-pixel-init')) el('debug-pixel-init').textContent = debugState.pixelInitialized ? 'yes' : 'no';
      if (el('debug-eventid')) el('debug-eventid').textContent = debugState.lastEventId || '-';
      if (el('debug-submit')) el('debug-submit').textContent = debugState.lastSubmitStatus || '-';
      if (el('debug-error')) el('debug-error').textContent = debugState.lastError || '-';
      if (el('debug-code')) el('debug-code').textContent = debugState.lastBackendCode || '-';
    }

    // Update overlay periodically
    setInterval(updateDebugOverlay, 500);
    updateDebugOverlay();

    // Expose update function globally
    window.updateDebugState = function(key, value) {
      debugState[key] = value;
      updateDebugOverlay();
    };
  })();
}

// Microsoft Clarity initialization
(function initClarity() {
  if (typeof window.clarity !== 'undefined') return;
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.defer=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "u0x0rm9t5v");
})();

// ============================================================
// META PIXEL - OFFICIAL STUB IMPLEMENTATION
// ============================================================
(function() {
  'use strict';
  
  const PIXEL_ID = "1540687500679034";
  const CONSENT_KEY = "vlm_cookie_consent";
  const DEV_MODE = new URLSearchParams(location.search).get('dev') === '1';
  
  // Event tracking flags (exposed for debug)
  window.__vlm_eventsFired = window.__vlm_eventsFired || {
    pageview: false,
    viewcontent: false
  };
  const eventsFired = window.__vlm_eventsFired;
  
  function log(...args) {
    if (DEV_MODE) console.log('[Meta]', ...args);
  }
  
  function hasConsent() {
    const consent = localStorage.getItem(CONSENT_KEY) === "accepted";
    if (DEV_MODE) {
      log('Consent status:', consent ? 'accepted' : 'not accepted');
      if (window.updateDebugState) {
        window.updateDebugState('consent', consent ? 'accepted' : 'not accepted');
      }
    }
    return consent;
  }
  
  // Create official Meta Pixel stub if it doesn't exist
  function ensureFbqStub() {
    if (window.fbq) {
      if (DEV_MODE) log('fbq already exists, using existing');
      return false; // Already exists
    }
    
    // Official Meta Pixel stub
    !function(f,b,e,v,n,t,s) {
      if(f.fbq)return;
      n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;
      n.push=n;
      n.loaded=!0;
      n.version='2.0';
      n.queue=[];
      t=b.createElement(e);
      t.async=!0;
      t.defer=!0;
      t.src=v;
      s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)
    }(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
    
    if (DEV_MODE) log('Official fbq stub created');
    return true; // Created new stub
  }
  
  // Ensure fbevents.js script is loaded
  function ensureFbqStubAndScript() {
    const scriptExists = !!document.querySelector('script[src*="connect.facebook.net/en_US/fbevents.js"]');
    const stubCreated = ensureFbqStub();
    
    if (scriptExists) {
      if (DEV_MODE) log('Script already in DOM, stub created:', stubCreated);
      if (window.updateDebugState) {
        window.updateDebugState('pixelLoaded', true);
      }
      return true; // Script exists, just need to wait for it to load
    }
    
    // Script doesn't exist, but stub might have injected it
    // If stub didn't inject it (because fbq already existed), inject manually
    if (!scriptExists && !stubCreated && window.fbq) {
      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      script.onload = function() {
        if (DEV_MODE) log('Script loaded manually');
        if (window.updateDebugState) {
          window.updateDebugState('pixelLoaded', true);
        }
      };
      script.onerror = function() {
        console.error('[Meta] Script load failed');
        if (DEV_MODE && window.updateDebugState) {
          window.updateDebugState('lastError', 'Pixel script load failed');
        }
      };
      document.head.appendChild(script);
      if (DEV_MODE) log('Script injected manually');
      if (window.updateDebugState) {
        window.updateDebugState('pixelLoaded', true);
      }
    }
    
    return true;
  }
  
  // Initialize pixel with retry logic
  function initPixel(retryCount = 0) {
    const MAX_RETRIES = 20;
    const RETRY_DELAY = 100;
    
    // Prevent double init
    if (window.__vlm_pixel_inited) {
      if (DEV_MODE) log('Pixel already initialized, skipping');
      return;
    }
    
    // Check if fbq is ready
    if (!window.fbq || typeof window.fbq !== 'function') {
      if (retryCount < MAX_RETRIES) {
        if (DEV_MODE && retryCount === 0) log('fbq not ready, waiting...');
        setTimeout(() => initPixel(retryCount + 1), RETRY_DELAY);
        return;
      } else {
        console.error('[Meta] fbq not available after retries');
        if (DEV_MODE && window.updateDebugState) {
          window.updateDebugState('lastError', 'fbq not available after retries');
        }
        return;
      }
    }
    
    try {
      // Get test event code from environment if available
      const testEventCode = window.ENV?.META_TEST_EVENT_CODE || null;
      
      // Initialize pixel with optional test event code
      if (testEventCode) {
        window.fbq('init', PIXEL_ID, {}, { testEventCode: testEventCode });
        if (DEV_MODE) log('Pixel initialized with test event code:', PIXEL_ID);
      } else {
        window.fbq('init', PIXEL_ID);
        if (DEV_MODE) log('Pixel initialized:', PIXEL_ID);
      }
      
      window.__vlm_pixel_inited = true;
      if (DEV_MODE && window.updateDebugState) {
        window.updateDebugState('pixelInitialized', true);
      }
      
      // Fire events after a brief delay to ensure pixel is ready
      setTimeout(function() {
        firePageView();
        fireViewContent();
      }, 200);
    } catch (e) {
      console.error('[Meta] Init failed:', e);
      if (DEV_MODE && window.updateDebugState) {
        window.updateDebugState('lastError', 'Pixel init failed: ' + String(e));
      }
    }
  }
  
  function firePageView() {
    if (eventsFired.pageview) return;
    if (!window.fbq || typeof window.fbq !== 'function') {
      if (DEV_MODE) log('Cannot fire PageView: fbq not available');
      return;
    }
    eventsFired.pageview = true;
    window.fbq('track', 'PageView');
    if (DEV_MODE) log('PageView fired');
  }
  
  function fireViewContent() {
    if (eventsFired.viewcontent) return;
    const path = location.pathname.replace(/\/+$/, "").replace(/\/index\.html$/, "");
    if (path !== "/iva") {
      if (DEV_MODE) log('ViewContent skipped: not on /iva path');
      return;
    }
    if (!window.fbq || typeof window.fbq !== 'function') {
      if (DEV_MODE) log('Cannot fire ViewContent: fbq not available');
      return;
    }
    eventsFired.viewcontent = true;
    window.fbq('track', 'ViewContent', { content_name: "IVA Landing Page" });
    if (DEV_MODE) log('ViewContent fired');
  }
  
  function checkAndLoad() {
    // Prevent double init
    if (window.__vlm_pixel_inited) {
      if (DEV_MODE) log('Already initialized, skipping');
      return;
    }
    
    if (!hasConsent()) {
      if (DEV_MODE) log('No consent - pixel will not load');
      return;
    }
    
    if (DEV_MODE) log('Consent accepted - ensuring pixel stub and script');
    ensureFbqStubAndScript();
    
    // Start initialization (with retry logic if needed)
    initPixel();
  }
  
  // Expose for cookie banner
  window.checkMetaPixelConsent = checkAndLoad;
  
  // Auto-load if consent already given
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndLoad);
  } else {
    checkAndLoad();
  }
})();

// Mock mode: show thank-you modal without network (dev preview only)
document.addEventListener('DOMContentLoaded', () => {
  if (!MOCK) return;
  if (typeof openThankYouModal === 'function') {
    openThankYouModal();
  } else if (DEV) {
    console.warn('[DEV] openThankYouModal not found');
  }
});



// Polyfill requestIdleCallback for older browsers (mobile performance)
if (!window.requestIdleCallback) {
  window.requestIdleCallback = function(cb, options) {
    const timeout = options?.timeout || 2000;
    const start = Date.now();
    return setTimeout(() => {
      cb({
        didTimeout: Date.now() - start > timeout,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
      });
    }, 1);
  };
  window.cancelIdleCallback = function(id) {
    clearTimeout(id);
  };
}

(function(){
  const _fbq = window.fbq;
  if (typeof _fbq !== "function") return;

  window.fbq = function(){
    try {
      if (arguments && arguments[0] === "init") {
        console.warn("[DEV][fbq init called]", arguments);
      }
      if (arguments && arguments[0] === "track") {
        console.log("[DEV][fbq track]", arguments);
      }
    } catch {}
    return _fbq.apply(this, arguments);
  };

  // preserve queue + properties
  Object.keys(_fbq).forEach(k => { window.fbq[k] = _fbq[k]; });
})();


   (function(){
    const modal = document.getElementById('exclusion-modal');
    if(!modal) return;
  
    const modalBox = modal.querySelector('.modal-box');
    const backdrop = modal.querySelector('.modal-backdrop');
    let lastFocused = null;
  
    function trapFocus(e){
      const focusables = modal.querySelectorAll(
        'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if(!focusables.length) return;
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      if(e.key === 'Tab'){
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      } else if(e.key === 'Escape'){
        closeExclusionModal();
      }
    }
  
    function openExclusionModal(){
      if(modal.classList.contains('is-open')) return;
      lastFocused = document.activeElement;
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('is-open');
      document.documentElement.classList.add('body-locked');
      document.body.classList.add('body-locked');
  
      // focus management
      requestAnimationFrame(()=>{
        modalBox.focus();
        document.addEventListener('keydown', trapFocus);
      });
    }
  
    function closeExclusionModal(){
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('is-open');
      document.documentElement.classList.remove('body-locked');
      document.body.classList.remove('body-locked');
      document.removeEventListener('keydown', trapFocus);
      if(lastFocused && typeof lastFocused.focus === 'function'){ lastFocused.focus(); }
    }
  
    // Click outside to close (optional; keep if you want non-blocking)
    backdrop.addEventListener('click', closeExclusionModal);
  
    // Expose to your existing logic
    window.openExclusionModal = openExclusionModal;
    window.closeExclusionModal = closeExclusionModal;
  
    // Example: auto-close after redirect window if you need it
    // setTimeout(()=> window.location.href = '/somewhere', 2500);
  })();

// ============================================================
// THANK-YOU MODAL - SIMPLE IMPLEMENTATION
// ============================================================
(function() {
  'use strict';
  
  const modal = document.getElementById('thank-you');
  if (!modal) return;

  const panel = modal.querySelector('.modal-box');
  const backdrop = modal.querySelector('.modal-backdrop');
  let lastFocused = null;

  function trapFocus(e) {
    const focusables = modal.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    } else if (e.key === 'Escape') {
      closeThankYouModal();
    }
  }

  function openThankYouModal() {
    // GA tracking only (no Meta events - Lead fires on submit success)
    if (typeof gtag === 'function') {
      gtag('event', 'thank_you_view', { form_id: 'iva_check' });
    }

    if (modal.classList.contains('is-open')) return;
    
    lastFocused = document.activeElement;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    document.documentElement.classList.add('body-locked');
    document.body.classList.add('body-locked');
    
    requestAnimationFrame(() => {
      panel.focus();
      document.addEventListener('keydown', trapFocus);
    });
  }

  function closeThankYouModal() {
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-open');
    document.documentElement.classList.remove('body-locked');
    document.body.classList.remove('body-locked');
    document.removeEventListener('keydown', trapFocus);
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  // Event listeners
  backdrop?.addEventListener('click', closeThankYouModal);
  document.getElementById('close-thank-you')?.addEventListener('click', closeThankYouModal);

  // Expose globally
  window.openThankYouModal = openThankYouModal;
  window.closeThankYouModal = closeThankYouModal;
})();

// Preview-only (no network, no Turnstile) - gated behind ?dev=1
if (DEV) {
  // 1) URL: ?show=thankyou -> thank-you modal
  if (new URLSearchParams(location.search).get('show') === 'thankyou') {
    window.openThankYouModal && window.openThankYouModal();
  }

  // 2) Keyboard shortcuts: Shift+S = overlay then thank-you; Shift+T = thank-you
  document.addEventListener('keydown', (e) => {
    if (!e.shiftKey) return;
    const k = e.key.toLowerCase();
    if (k === 's') {
      e.preventDefault();
      if (typeof setSubmitting === 'function') setSubmitting(true);
      setTimeout(() => {
        if (typeof setSubmitting === 'function') setSubmitting(false);
        window.openThankYouModal && window.openThankYouModal();
      }, 800);
    } else if (k === 't') {
      e.preventDefault();
      window.openThankYouModal && window.openThankYouModal();
    }
  });

  // 3) Optional button anywhere in the DOM:
  // <button type="button" data-show-thankyou>Show Thank-You</button>
  document.querySelector('[data-show-thankyou]')?.addEventListener('click', () => {
    window.openThankYouModal && window.openThankYouModal();
  });
}

// FormStart tracking (GA only - no Meta custom events)
(function setupFormStart() {
  const form = document.querySelector('#iva-check-form');
  if (!form) return;
  form.addEventListener('focusin', () => {
    if (window.formStarted) return;
    window.formStarted = true;
    if (typeof gtag === 'function') {
      gtag('event', 'form_start', { form_id: 'iva_check' });
      gtag('event', 'step_1_reached', { form_id:'iva_check', step: 1 });
    }
  }, { once: false });
})();

// Event ID for CAPI dedupe
function getOrCreateLeadEventId() {
  try {
    let id = sessionStorage.getItem('lead_event_id');
    if (!id) {
      id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('lead-' + Date.now());
      sessionStorage.setItem('lead_event_id', id);
    }
    return id;
  } catch {
    return (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('lead-' + Date.now());
  }
}





   
(function(){
  const bar = document.querySelector('.sticky-cta-footer');
  if(!bar) return;

  let lastY = window.pageYOffset || 0;
  let hidden = false;
  let initialHidden = false;

  const hide = () => { if(!hidden){ bar.classList.add('is-hidden'); hidden = true; } };
  const show = () => { if(hidden){ bar.classList.remove('is-hidden'); hidden = false; } };

  // Hide on first down-scroll; show when user scrolls up
  // Throttled for better mobile performance
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    if (scrollTimeout) return;
    scrollTimeout = requestAnimationFrame(() => {
      const y = window.pageYOffset || document.documentElement.scrollTop;
      const delta = y - lastY;

      // Hide as soon as they start scrolling down
      if (!initialHidden && y > 8) {
        hide();
        initialHidden = true;
        lastY = y;
        scrollTimeout = null;
        return;
      }

      if (Math.abs(delta) > 3){
        if (delta > 0) hide();      // down
        else show();                // up
        lastY = y;
      }
      scrollTimeout = null;
    });
  }, {passive:true});

  // If mobile keyboard opens (viewport height drops), hide to avoid overlap
  if (window.visualViewport){
    const vv = window.visualViewport;
    vv.addEventListener('resize', () => {
      if (vv.height < window.innerHeight - 120) hide();
      else if (initialHidden) show();
    }, {passive:true});
  }
})();

  // ---------- boot ---------- //

// ===========================
// Modal helpers (global scope - explicitly on window for minification safety)
// ===========================
// Modal functions are now provided by /js/modal-runtime.js via window.App.Modal namespace



// ===== Consent wording (exact text saved to Airtable) =====
const CONSENT_VERSION = "2025-09-25";
const CONSENT_WORDING = [
  "I consent to Visible Legal Marketing processing my personal data to assess my IVA claim and to contact me about my case.",
  "I understand my details may be shared with a panel solicitor solely to review my case and, if appropriate, to act on my instructions.",
  "I understand I can withdraw consent at any time, and that my data will be handled in line with the Privacy Policy."
].join(" ");

// ===== UTM capture (no cookies, privacy-safe) =====
const UTM_KEYS = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid","fbclid","msclkid"];

function captureUtmFirstTouch() {
  const params = new URLSearchParams(window.location.search);
  let foundAny = false;

  UTM_KEYS.forEach(k => {
    const v = params.get(k);
    if (v) { sessionStorage.setItem(k, v); foundAny = true; }
  });

  // If any tracking param present, record first-touch context
  if (foundAny && !sessionStorage.getItem("utm_timestamp_utc")) {
    sessionStorage.setItem("utm_landing_page", location.href.split("#")[0]);
    sessionStorage.setItem("utm_referrer", document.referrer || "");
    sessionStorage.setItem("utm_timestamp_utc", new Date().toISOString());
  }
}

function stampUtmHiddenFields(formEl) {
  const get = (k) => sessionStorage.getItem(k) || new URLSearchParams(location.search).get(k) || "";
  UTM_KEYS.forEach(k => {
    const el = formEl.querySelector(`#${k}`);
    if (el) el.value = get(k) || "";
  });

  const lp = formEl.querySelector("#utm_landing_page");
  const rf = formEl.querySelector("#utm_referrer");
  const ts = formEl.querySelector("#utm_timestamp_utc");
  if (lp) lp.value = sessionStorage.getItem("utm_landing_page") || location.href.split("#")[0];
  if (rf) rf.value = sessionStorage.getItem("utm_referrer") || document.referrer || "";
  if (ts) ts.value = sessionStorage.getItem("utm_timestamp_utc") || new Date().toISOString();
}



//VISIBILITY HELPER AND AUTO-SCROLL
const isVisible = (el) => {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  // also treat ancestors with display:none as hidden
  let node = el;
  while (node) {
    if (node.classList?.contains("hidden")) return false;
    node = node.parentElement;
  }
  return true;
};

function scrollToFirstError() {
  // prefer first invalid input with our styling
  let target = document.querySelector(".form-step.active .input-error");

  if (!target) {
    // otherwise pick the first visible, non-empty error message
    const errors = Array.from(document.querySelectorAll(".form-step.active .error-message"));
    const visibleErr = errors.find(e =>
      e.textContent.trim().length > 0 &&
      window.getComputedStyle(e).display !== "none"
    );
    if (visibleErr) {
      const anchored = visibleErr.closest("[data-error-anchor]");
      const prev = visibleErr.previousElementSibling;
      target = anchored || prev || visibleErr;
    }
  }

  if (!target) return;

  const header = document.querySelector(".site-header");
  const headerH = header ? header.getBoundingClientRect().height : 0;

  // wait a tick so layout has applied error styles
  requestAnimationFrame(() => {
    const y = target.getBoundingClientRect().top + window.pageYOffset - (headerH + 16);
    window.scrollTo({ top: y, behavior: "smooth" });
    if (typeof target.focus === "function") {
      target.focus({ preventScroll: true });
    }
  });
}

  let currentStep = 0;
  let steps = [];

  // ---------- Turnstile global guard (prevent double-render) ----------
  window.__CF_TURNSTILE_RENDERED__ = window.__CF_TURNSTILE_RENDERED__ || false;

  // ---------- tiny DOM helpers ----------
  const qs  = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const on  = (el, ev, fn) => el && el.addEventListener(ev, fn);

  // --- tiny delay helper for "confidence" feel ---
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- lightweight submit overlay (created on demand) ---
let submitOverlay;
function ensureSubmitOverlay(){
  if (submitOverlay) return submitOverlay;
  submitOverlay = document.createElement('div');
  submitOverlay.className = 'submitting-overlay';
  submitOverlay.innerHTML = `
    <div class="submitting-box">
      <div class="submitting-spinner"></div>
      <div class="submitting-text">
        <strong>Submitting your details…</strong><br/>This usually takes a few seconds.
      </div>
    </div>`;
  document.body.appendChild(submitOverlay);
  return submitOverlay;
}
function setSubmitting(on){
  const ov = ensureSubmitOverlay();
  if (on) {
    ov.classList.add('show');
    // defensively disable obvious clickable things
    document.querySelectorAll('button, .next-btn, .prev-btn, .submit-btn').forEach(b => b.disabled = true);
  } else {
    ov.classList.remove('show');
    document.querySelectorAll('button, .next-btn, .prev-btn, .submit-btn').forEach(b => b.disabled = false);
  }
}

// 2) URL: ?show=submitting -> overlay for ~1s then thank-you (preview only, no network) - gated behind ?dev=1
if (DEV && new URLSearchParams(location.search).get('show') === 'submitting') {
  if (typeof setSubmitting === 'function') setSubmitting(true);
  setTimeout(() => {
    if (typeof setSubmitting === 'function') setSubmitting(false);
    window.openThankYouModal && window.openThankYouModal();
  }, 1000);
}


  const setVisible = (el, show, mode = "class") => {
    if (!el) return;
    if (mode === "style") el.style.display = show ? "block" : "none";
    else el.classList[show ? "remove" : "add"]("hidden");
  };

  const toggleRequired = (el, required) => {
    if (!el) return;
    if (required) el.setAttribute("required", "required");
    else el.removeAttribute("required");
  };

  //ERROR LOGIC

  // --- error element helpers (CSP-safe; no inline styles) ---
const getOrCreateErrorEl = (input) => {
  if (!input?.id) return null;
  let err = document.querySelector(`#${input.id}-error`);
  if (!err) {
    err = document.createElement("p");
    err.id = `${input.id}-error`;
    err.className = "error-message";
    input.insertAdjacentElement("afterend", err);
  }
  // a11y
  err.setAttribute("role", "alert");
  err.setAttribute("aria-live", "polite");
  return err;
};

const showError = (input, message, { force = false } = {}) => {
  if (!input) return;

  const err = getOrCreateErrorEl(input);
  if (err) err.textContent = message || "";  // text drives visibility
  input.classList.add("input-error");
  input.setAttribute("aria-invalid", "true");
  if (err) input.setAttribute("aria-describedby", err.id);
};

const clearError = (input) => {
  if (!input) return;
  const err = document.querySelector(`#${input.id}-error`);
  if (err) err.textContent = "";                // empty => hidden via CSS
  input.classList.remove("input-error");
  input.removeAttribute("aria-invalid");
  input.removeAttribute("aria-describedby");
};

// Hide/show without touching inline styles (CSP-safe)
const toggleHidden = (el, hidden) => {
  if (!el) return;
  el.classList.toggle('hidden', !!hidden);
};


// Set/clear a group/radio error by its error element id (no inline styles)
const setGroupError = (errorId, message) => {
  const err = document.querySelector(`#${errorId}`);
  if (err) err.textContent = message || "";   // empty => hidden
};


  // Full Name validation — 2–80 chars, at least two words, letters with optional internal ' or -, no digits, no URLs/emails, reject obvious junk
  function isValidName(s) {
    const str = String(s || "").trim().replace(/\s+/g, " ");
    if (str.length < 2 || str.length > 80) return false;
    if (/[0-9@/\\]|https?:\/\//i.test(str)) return false; // no digits, no @, no URLs

    // Must be at least two words
    const parts = str.split(" ");
    if (parts.length < 2) return false;

    // Each token: letters with optional internal ' or - (not at start/end, no repeats like "--", "''")
    const tokenRe = /^(?=.{2,40}$)[A-Za-z]+(?:[\'-][A-Za-z]+)*$/;
    for (const p of parts) {
      if (!tokenRe.test(p)) return false;
    }

    // At least 2 letters overall (already implied), and avoid long repeated chars
    if (/(.)\1{3,}/.test(str)) return false;

    // Obvious garbage / banned substrings
    const lower = str.toLowerCase();
    const banned = ["test", "asdf", "qwerty", "none", "na", "n/a", "aaa", "unknown"];
    if (banned.some(b => lower === b || lower.includes(b + " "))) return false;

    return true;
  }

  // Email validation — 6–254 chars, local part >= 2 chars, sensible domain/TLD, block disposable/common fakes, block single-letter emails like j@outlook.com
  function isValidEmail(s) {
    const str = String(s || "").trim();
    if (str.length < 6 || str.length > 254) return false;
    if (/\s/.test(str)) return false;

    const at = str.indexOf("@");
    if (at <= 0 || at === str.length - 1) return false;

    const local = str.slice(0, at);
    const domain = str.slice(at + 1);

    // local-part min length 2 (blocks j@outlook.com), and no consecutive dots or leading/trailing dots
    if (local.length < 2 || local.length > 64) return false;
    if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;

    // Domain must have one dot, labels 1–63 chars, TLD 2–63 letters
    if (!/^[A-Za-z0-9.-]+$/.test(domain)) return false;
    if (domain.split(".").length < 2) return false;
    const labels = domain.split(".");
    if (labels.some(l => l.length === 0 || l.length > 63 || !/^[A-Za-z0-9-]+$/.test(l) || l.startsWith("-") || l.endsWith("-"))) return false;
    const tld = labels[labels.length - 1];
    if (!/^[A-Za-z]{2,63}$/.test(tld)) return false;

    // Block common fake/disposable patterns
    const lower = str.toLowerCase();
    const bannedStarts = ["test@", "example@", "invalid@", "none@", "no@", "fake@", "spam@"];
    if (bannedStarts.some(b => lower.startsWith(b))) return false;

    const disposableDomains = [
      "mailinator.com","guerrillamail.com","10minutemail.com","tempmail.com","yopmail.com",
      "tmpmail.org","discard.email","getnada.com","trashmail.com","sharklasers.com"
    ];
    const dLower = domain.toLowerCase();
    if (disposableDomains.includes(dLower)) return false;

    return true;
  }



  // ---------- Turnstile rendering (robust single-render) ----------
  function renderTurnstileIfNeeded() {
    try {
      // Only on final step
      const isFinal = (typeof currentStep !== "undefined") && (typeof steps !== "undefined") && (currentStep === steps.length - 1);
      if (!isFinal) return;

      const el = document.getElementById("cf-container");
      if (!el) return;

      // Already rendered? bail
      if (el.dataset.rendered === "true" || window.__CF_TURNSTILE_RENDERED__ === true) return;

      // If Turnstile already injected an iframe, bail
      if (el.querySelector('iframe[src*="turnstile"]')) {
        el.dataset.rendered = "true";
        window.__CF_TURNSTILE_RENDERED__ = true;
        return;
      }

      // Script not ready yet
      if (!window.turnstile || typeof window.turnstile.render !== "function") return;

      const siteKey = el.getAttribute("data-sitekey") || window.TURNSTILE_SITE_KEY || "";
      if (!siteKey) return; // allow page to run without breaking if key is missing

      window.turnstile.render(el, {
        sitekey: siteKey,
        callback: (token) => {
          const h = document.getElementById("cf_token");
          if (h) h.value = token || "";
        }
      });

      el.dataset.rendered = "true";
      window.__CF_TURNSTILE_RENDERED__ = true;
    } catch (e) {
      // do not throw; fail closed and allow later attempts when script is ready
    }
  }

  // Turnstile success callback (global for data-callback)
  window.onTurnstileSuccess = function(token) {
    const h = document.getElementById("cf_token");
    if (h) h.value = token || "";
    const err = document.getElementById("cf-turnstile-error");
    if (err) err.textContent = "";
  };

  // ---------- progress / step nav ----------
  function goToStep(index) {
    if (!steps.length || index < 0 || index >= steps.length) return;
    steps[currentStep]?.classList.remove("active");
    currentStep = index;
    steps[currentStep].classList.add("active");

    const total = steps.length;
    const progress = ((currentStep + 1) / total) * 100;
    qs("#progress-bar").style.width = `${progress}%`;
    qs("#progress-label").textContent = `Step ${currentStep + 1} of ${total}`;

    // Render Turnstile when entering final step
    if (currentStep === steps.length - 1) {
      // Wait a bit for the step to be visible
      setTimeout(() => {
        renderTurnstileIfNeeded();
      }, 100);
    }

    saveFormData(); // persist on navigation
  }

  // Step tracking helper (GA only - no Meta custom events)
  function trackStep(stepNumber) {
    if (typeof gtag === 'function') {
      gtag('event', `step_${stepNumber}_reached`, { form_id:'iva_check', step: stepNumber });
    }
  }

  function initProgress() {
    const total = steps.length || 4;
    qs("#progress-label").textContent = `Step 1 of ${total}`;
    qs("#progress-bar").style.width = `${100 / total}%`;
  }

  const controllers = {
    providerOther: () => {
      const sel = qs("#iva-provider");
      const otherWrap = qs("#other-provider-container");
      const other = qs("#other-provider");
      const isOther = sel?.value === "Other";
  
      // show only when "Other"
      toggleHidden(otherWrap, !isOther);
      toggleRequired(other, isOther);
  
      if (!isOther) {
        other.value = "";
        clearError(other); // clears text + aria, no inline styles
      }
  
      updateProviderDisplay();
    },
  
    residentialOther: () => {
      const status = qs("#residentialStatus");
      const wrap = qs("#residentialOtherContainer");
      const area = qs("#otherResidentialDetails");
      const isOther = status?.value === "Other";
  
      toggleHidden(wrap, !isOther);
      toggleRequired(area, isOther);
  
      if (!isOther) {
        area.value = "";
        clearError(area);
      }
    },
  
    previousAddress: () => {
  const val  = qs('input[name="livedAtAddress"]:checked')?.value;
  const wrap = qs("#previous-address");
  const show = val === "No";

  toggleHidden(wrap, !show);

  const ids = ["previousAddress","previousCity","previousPostcode"];
  ids.forEach(id => toggleRequired(qs(`#${id}`), show));

  if (!show) {
    ids.forEach(id => { const el = qs(`#${id}`); if (el) { el.value = ""; clearError(el); } });
    // ✘ removed: setGroupError("livedAtAddress-error", "");
  }
},

dependants: () => {
  const val   = qs('input[name="hadDependants"]:checked')?.value;
  const group = qs("#dependant-details-group");

  toggleHidden(group, val !== "Yes");

  if (val !== "Yes") {
    const input = qs("#dependantDetails");
    if (input) { input.value = ""; clearError(input); }
    setGroupError("dependantDetails-error", "");
    // ✘ removed: setGroupError("hadDependants-error", "");
  }
},

  
    signedOnPhone: () => {
      const val  = qs('input[name="signedElectronically"]:checked')?.value;
      const wrap = qs("#signedOnPhoneContainer");
  
      // show only when signed electronically = Yes
      toggleHidden(wrap, val !== "Yes");
  
      if (val !== "Yes") {
        qsa('input[name="signedOnPhone"]').forEach(r => (r.checked = false));
        setGroupError("signedOnPhone-error", "");
      }
    },
  
    ivaType: () => {
      const selected = qs('input[name="ivaType"]:checked')?.value;
      const partnerGroup = qs("#partnerNameGroup");
      const partner  = qs("#partnerName");
  
      if (selected === "Joint") {
        // show partner name group
        toggleHidden(partnerGroup, false);
        toggleRequired(partner, true);
      } else {
        // hide partner name group
        toggleHidden(partnerGroup, true);
        toggleRequired(partner, false);
  
        if (partner) {
          partner.value = "";
          clearError(partner);
        }
  
        // clear any group errors (no inline styles)
        setGroupError("partnerName-error", "");
      }
    }
  };
  

  function reapplyAllConditionalVisibility() {
    Object.values(controllers).forEach(fn => fn());
  }

  // ---------- validation ----------

// helpers already in your file, repeated here for clarity.
// If you already defined CSP-safe versions earlier, keep only one copy.

// Radio checked?
const isRadioChecked = (name) => !!qs(`input[name="${name}"]:checked`);

// OPTIONAL convenience: set/clear error for a radio group by its name
const setRadioGroupError = (name, msgIfMissing) => {
  const picked = qs(`input[name="${name}"]:checked`);
  setGroupError(`${name}-error`, picked ? "" : msgIfMissing);
  return !!picked;
};

// === Phone parsing/validation (kept as you wrote) ===

// Accept flexible input and normalize to local '7xxxxxxxxx'
function parseUKMobile(input) {
  const digits = String(input || "").replace(/\D+/g, "");
  if (!digits) return null;

  if (digits.length === 11 && digits.startsWith("07")) return digits.slice(1);         // 07xxxxxxxxx
  if (digits.length === 10 && digits.startsWith("7"))  return digits;                  // 7xxxxxxxxx
  if (digits.length === 12 && digits.startsWith("44") && digits[2] === "7") return digits.slice(2); // 447…
  if (digits.length === 14 && digits.startsWith("0044") && digits[4] === "7") return digits.slice(4); // 00447…
  return null;
}
function isValidUKMobileFlexible(input) { return !!parseUKMobile(input); }
function toE164UKFlexible(input)       { const local = parseUKMobile(input); return local ? `+44${local}` : null; }
// Back-compat aliases
function isValidUKMobileLocal(input) { return isValidUKMobileFlexible(input); }
function toE164UK(input)             { return toE164UKFlexible(input); }


// ===== Consent =====
function validateConsent() {
  const any = qsa('input[name="consentGiven"]').some(r => r.checked);
  setGroupError("consentGiven-error", any ? "" : "Please indicate if you give consent.");
  return any;
}


  // ---------- eligibility gate ----------
  function isClientExcluded() {
    const status = qs('input[name="ivaStatus"]:checked')?.value?.toLowerCase();
    const payment = parseFloat(qs("#monthlyPayment")?.value?.trim() || "0");
    const debt = qs('input[name="debtLevel"]:checked')?.value;

    // Exclude if IVA still active (shouldn't be possible via UI, but safe)
    if (status === "active") return true;

    // Exclude if debt < £7,500 AND payment < £150
    if (debt === "0-7500" && payment < 150) return true;

    return false;
  }

  function showExclusionMessage() {
    const modal = document.getElementById("exclusion-modal");
    if (!modal) return;
  
    // open the real overlay (adds .is-open, aria-hidden=false, locks body)
    if (typeof window.openExclusionModal === "function") {
      window.openExclusionModal();
    } else {
      // fallback if bootstrap ever changes
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add('body-locked');
      document.body.classList.add('body-locked');
    }
  
    // defensively disable nav buttons so user can’t continue
    document.querySelectorAll(".next-btn").forEach(b => (b.disabled = true));
  
    // redirect after brief read time
    setTimeout(() => { window.location.href = "./not-eligible.html"; }, 3000);
  }
  

  // ---------- persistence ----------
  function saveFormData() {
    const form = qs("#iva-check-form");
    // ADD THIS GUARD directly below:
    if (!form) {
      console.error('Form #iva-check-form not found — check the HTML id matches the script.');
      return; // prevents the rest of the submit wiring from silently failing
    }
    const fd = new FormData(form);
    const obj = {};
    fd.forEach((v, k) => { 
      // Save dob-display value as "dob" for form state (so it restores correctly)
      if (k === 'dob-display') {
        obj.dob = v;
      } else if (k !== 'dob-formatted') {
        // Don't save the formatted hidden field, we'll regenerate it
        obj[k] = v;
      }
    });
    localStorage.setItem("ivaFormState", JSON.stringify({ formData: obj, currentStep }));
  }

  function loadFormData() {
    const raw = localStorage.getItem("ivaFormState");
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data?.formData) {
        Object.entries(data.formData).forEach(([key, value]) => {
          // Special handling for DOB field - convert ISO to DD/MM/YYYY
          if (key === 'dob' && value) {
            const dobInput = document.getElementById('dob');
            const dobFormatted = document.getElementById('dob-formatted');
            if (dobInput) {
              // Check if value is in ISO format (YYYY-MM-DD) or already in DD/MM/YYYY
              const isoMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
              if (isoMatch) {
                // Convert ISO to DD/MM/YYYY for display
                dobInput.value = `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
                if (dobFormatted) dobFormatted.value = value; // Keep ISO format in hidden field
              } else {
                // Assume it's already in DD/MM/YYYY format (from form state)
                dobInput.value = value;
                // Convert to ISO format for hidden field
                const parts = String(value).split('/');
                if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
                  if (dobFormatted) dobFormatted.value = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
              }
            }
            return;
          }
          
          // Skip dob-display and dob-formatted as they're handled above
          if (key === 'dob-display' || key === 'dob-formatted') return;
          
          const field = qs(`[name="${key}"]`);
          if (!field) return;
          if (field.type === "radio" || field.type === "checkbox") {
            const match = qs(`[name="${key}"][value="${value}"]`);
            if (match) match.checked = true;
          } else {
            field.value = value;
          }
        });
        // restore conditional UI once
        reapplyAllConditionalVisibility();
      }
      if (typeof data.currentStep === "number" && steps[data.currentStep]) {
        qs("#form-section")?.classList.remove("hidden");
        qs("#form-section")?.scrollIntoView({ behavior: "smooth" });
        goToStep(data.currentStep);
      }
    } catch { /* ignore */ }
  }

  // Maps the *selected* legacy provider to the *current* firm handling it (if applicable)
const IVA_PROVIDER_TAKEOVERS = {
  Aperture:            { canonical: "Debt Movement" },
  GrantThornton:       { canonical: "Debt Movement" },
  JarvisInsolvency:    { canonical: "Debt Movement" }, // rebrand
  HanoverInsolvency:   { canonical: "Ebenegate" },
  HarringtonBrooks:    { canonical: "Freeman Jones" }
};


function updateProviderDisplay() {
  const sel = qs("#iva-provider");

  const displayEl = qs("#iva-provider-display");
  const originalEl = qs("#iva-provider-original");
  const canonicalEl = qs("#iva-provider-canonical");

  const otherInput = qs("#other-provider");

  if (!sel || !displayEl) return;

  const isOther = sel.value === "Other";

  // If "Other", we can't canonicalise reliably, so treat entered value as all three.
  if (isOther) {
    const otherVal = (otherInput?.value || "").trim();
    displayEl.value = otherVal;
    if (originalEl) originalEl.value = otherVal;
    if (canonicalEl) canonicalEl.value = otherVal;
    return;
  }

  const selectedLabel = (sel.selectedOptions[0]?.text || "").trim(); // what user picked
  const takeover = IVA_PROVIDER_TAKEOVERS[sel.value];
  const canonicalLabel = takeover?.canonical || selectedLabel;

  // Human-friendly LOA string:
  // "Debt Movement (formerly Aperture)" where takeover exists
  const display =
    canonicalLabel !== selectedLabel
      ? `${canonicalLabel} (formerly ${selectedLabel})`
      : selectedLabel;

  displayEl.value = display;
  if (originalEl) originalEl.value = selectedLabel;
  if (canonicalEl) canonicalEl.value = canonicalLabel;
}


  // ===========================
  // Modal helpers (shared)
  // ===========================
  async function loadPartialInto(selector, url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const el = document.querySelector(selector);
      if (el) {
        el.innerHTML = html;
        return true;
      }
    } catch (err) {
      console.warn('Partial load failed:', url, err);
      return false;
    }
    return false;
  }



document.addEventListener("DOMContentLoaded", () => {
  // ===========================
  // Critical path: only essential initialization
  // ===========================
  
  // Generate lead ID immediately (needed for form)
  const leadIdEl = document.getElementById('leadId');
  if (leadIdEl && !leadIdEl.value) {
    leadIdEl.value = (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('tmp-' + Date.now());
  }

  // DOB input: Text-based with formatting for mobile typing
  const dobInput = document.getElementById('dob');
  const dobFormatted = document.getElementById('dob-formatted');
  
  if (dobInput) {
    const today = new Date();
    const maxYear = today.getFullYear();
    const maxMonth = String(today.getMonth() + 1).padStart(2, '0');
    const maxDay = String(today.getDate()).padStart(2, '0');
    const maxDate = `${maxYear}-${maxMonth}-${maxDay}`;
    
    // Format date as user types (DD/MM/YYYY) - mobile-friendly version
    function formatDateInput(value) {
      // Remove all non-digits
      let digits = value.replace(/\D/g, '');
      
      // Limit to 8 digits (DDMMYYYY) - STRICT LIMIT
      if (digits.length > 8) {
        digits = digits.slice(0, 8);
      }
      
      // Format with slashes
      let formatted = '';
      if (digits.length > 0) {
        formatted = digits.slice(0, 2);
      }
      if (digits.length > 2) {
        formatted += '/' + digits.slice(2, 4);
      }
      if (digits.length > 4) {
        formatted += '/' + digits.slice(4, 8);
      }
      
      return formatted;
    }
    
    // Convert DD/MM/YYYY to YYYY-MM-DD for backend
    function convertToISOFormat(value) {
      const parts = value.split('/');
      if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
        const day = parts[0];
        const month = parts[1];
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
      return '';
    }
    
    // Validate date
    function isValidDate(value) {
      const parts = value.split('/');
      if (parts.length !== 3) return false;
      
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      
      // Basic range checks
      if (year < 1900 || year > maxYear) return false;
      if (month < 1 || month > 12) return false;
      if (day < 1 || day > 31) return false;
      
      // Check if date is valid and not in future
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return false;
      }
      
      // Check not in future
      const inputDate = new Date(year, month - 1, day);
      if (inputDate > today) return false;
      
      return true;
    }
    
    // Mobile-friendly formatting function that always applies formatting
    function applyFormatting(inputEl) {
      if (!inputEl) return;
      
      const currentValue = inputEl.value || '';
      const digitsOnly = currentValue.replace(/\D/g, '');
      
      // STRICT: Always limit to 8 digits maximum
      const limitedDigits = digitsOnly.length > 8 ? digitsOnly.slice(0, 8) : digitsOnly;
      
      // Always format, even if it seems the same
      const formatted = formatDateInput(limitedDigits);
      
      // Only update if value actually changed (to avoid cursor issues)
      if (formatted !== currentValue) {
        const cursorPos = inputEl.selectionStart || 0;
        const oldDigits = currentValue.replace(/\D/g, '').length;
        const newDigits = formatted.replace(/\D/g, '').length;
        
        // Update the value
        inputEl.value = formatted;
        
        // Calculate new cursor position based on digit count before cursor
        let newCursorPos = cursorPos;
        if (oldDigits !== newDigits) {
          // Count digits before cursor in old value
          const beforeCursor = currentValue.substring(0, Math.min(cursorPos, currentValue.length));
          const digitsBeforeCursor = beforeCursor.replace(/\D/g, '').length;
          
          // Find position in new formatted value with same number of digits before cursor
          let pos = 0;
          let digitsFound = 0;
          for (let i = 0; i < formatted.length; i++) {
            if (/\d/.test(formatted[i])) {
              digitsFound++;
              if (digitsFound > digitsBeforeCursor) {
                pos = i;
                break;
              }
            }
            pos = i + 1;
          }
          newCursorPos = Math.min(pos, formatted.length);
        } else {
          // Same number of digits, try to maintain relative position
          // Count non-digits before cursor
          const nonDigitsBefore = (currentValue.substring(0, cursorPos).match(/\D/g) || []).length;
          const nonDigitsInFormatted = (formatted.match(/\D/g) || []).length;
          
          // Adjust cursor position based on slash positions
          if (nonDigitsBefore !== nonDigitsInFormatted) {
            // Recalculate based on digit position
            const beforeCursor = currentValue.substring(0, cursorPos);
            const digitsBefore = beforeCursor.replace(/\D/g, '').length;
            let pos = 0;
            let digitsFound = 0;
            for (let i = 0; i < formatted.length && digitsFound < digitsBefore; i++) {
              if (/\d/.test(formatted[i])) {
                digitsFound++;
              }
              pos = i + 1;
            }
            newCursorPos = Math.min(pos, formatted.length);
          }
        }
        
        // Ensure cursor is within bounds
        newCursorPos = Math.max(0, Math.min(newCursorPos, formatted.length));
        
        // Set cursor position (use requestAnimationFrame for mobile compatibility)
        requestAnimationFrame(() => {
          try {
            inputEl.setSelectionRange(newCursorPos, newCursorPos);
          } catch (e) {
            // Ignore if selection fails (can happen on some mobile browsers)
          }
        });
      }
      
      // Update hidden field and validation
      const finalValue = inputEl.value;
      if (isValidDate(finalValue)) {
        const isoFormat = convertToISOFormat(finalValue);
        if (dobFormatted) dobFormatted.value = isoFormat;
        clearError(inputEl);
      } else if (finalValue.length === 10) {
        // Only show error if fully entered but invalid
        showError(inputEl, "Please enter a valid date of birth");
        if (dobFormatted) dobFormatted.value = '';
      } else {
        if (dobFormatted) dobFormatted.value = '';
      }
    }
    
    // Use input event (works on both desktop and mobile)
    let formattingTimeout;
    dobInput.addEventListener('input', function(e) {
      // Clear any pending formatting
      if (formattingTimeout) {
        clearTimeout(formattingTimeout);
      }
      // Apply formatting immediately
      applyFormatting(this);
    }, { passive: true });
    
    // Also use keyup as fallback for mobile (iOS sometimes doesn't fire input consistently)
    dobInput.addEventListener('keyup', function(e) {
      // Only format on number keys, not navigation keys
      const isNumberKey = (e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 96 && e.keyCode <= 105);
      if (isNumberKey) {
        // Small delay to ensure value is updated
        if (formattingTimeout) {
          clearTimeout(formattingTimeout);
        }
        formattingTimeout = setTimeout(() => {
          applyFormatting(this);
        }, 10);
      }
    }, { passive: true });
    
    // Also use beforeinput for better mobile support (where available)
    if ('onbeforeinput' in dobInput) {
      dobInput.addEventListener('beforeinput', function(e) {
        // Allow digits, backspace, delete, arrow keys
        if (e.inputType === 'insertText' || e.inputType === 'insertCompositionText') {
          const char = e.data;
          if (char && !/\d/.test(char)) {
            e.preventDefault();
            return;
          }
        }
      }, { passive: false });
    }
    
    // Handle composition events (for mobile keyboards that use composition)
    dobInput.addEventListener('compositionend', function() {
      // Format after composition ends (mobile keyboards)
      setTimeout(() => {
        applyFormatting(this);
      }, 10);
    }, { passive: true });
    
    // Additional check on focus to ensure formatting is applied
    dobInput.addEventListener('focus', function() {
      // Apply formatting when field is focused (in case value was changed programmatically)
      setTimeout(() => {
        applyFormatting(this);
      }, 0);
    }, { passive: true });
    
    // Aggressive check: Monitor value changes when focused (iOS fallback)
    // This is a fallback for cases where input events don't fire properly on iOS
    let lastValue = dobInput.value;
    let valueCheckInterval = null;
    
    dobInput.addEventListener('focus', function() {
      // Start checking when focused
      if (valueCheckInterval) {
        clearInterval(valueCheckInterval);
      }
      lastValue = this.value;
      valueCheckInterval = setInterval(() => {
        if (this.value !== lastValue) {
          lastValue = this.value;
          // Check if value needs formatting
          const digitsOnly = this.value.replace(/\D/g, '');
          if (digitsOnly.length > 8 || this.value !== formatDateInput(this.value)) {
            applyFormatting(this);
            lastValue = this.value;
          }
        }
      }, 150); // Check every 150ms when focused
    }, { passive: true });
    
    dobInput.addEventListener('blur', function() {
      // Stop checking when blurred
      if (valueCheckInterval) {
        clearInterval(valueCheckInterval);
        valueCheckInterval = null;
      }
      // Final format check on blur
      applyFormatting(this);
    }, { passive: true });
    
    // Clean up on page unload
    window.addEventListener('beforeunload', function() {
      if (valueCheckInterval) {
        clearInterval(valueCheckInterval);
      }
    });
    
    // Handle paste events
    dobInput.addEventListener('paste', function(e) {
      e.preventDefault();
      const pastedText = (e.clipboardData || window.clipboardData).getData('text');
      const digitsOnly = pastedText.replace(/\D/g, '').slice(0, 8);
      if (digitsOnly) {
        this.value = formatDateInput(digitsOnly);
        applyFormatting(this);
        // Move cursor to end
        requestAnimationFrame(() => {
          try {
            this.setSelectionRange(this.value.length, this.value.length);
          } catch (e) {}
        });
      }
    }, { passive: false });
    
    // Validate on blur
    dobInput.addEventListener('blur', function() {
      const value = this.value.trim();
      if (value) {
        // Ensure formatting is applied one more time
        applyFormatting(this);
        const finalValue = this.value.trim();
        if (finalValue && !isValidDate(finalValue)) {
          showError(this, "Please enter a valid date of birth (DD/MM/YYYY)");
          if (dobFormatted) dobFormatted.value = '';
        } else if (finalValue && isValidDate(finalValue)) {
          const isoFormat = convertToISOFormat(finalValue);
          if (dobFormatted) dobFormatted.value = isoFormat;
          clearError(this);
        }
      }
    }, { passive: true });
    
    // Prevent non-numeric input on keydown (but allow all navigation/editing keys)
    dobInput.addEventListener('keydown', function(e) {
      // Allow: backspace, delete, tab, escape, enter, arrow keys, home, end
      const allowedKeys = [8, 9, 27, 13, 37, 38, 39, 40, 35, 36, 46];
      if (allowedKeys.indexOf(e.keyCode) !== -1) {
        return;
      }
      
      // Allow Ctrl/Cmd combinations (for select all, copy, paste, etc.)
      if (e.ctrlKey || e.metaKey) {
        return;
      }
      
      // For mobile, we're more permissive - let the input event handle filtering
      // But on desktop, prevent non-numeric immediately
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (!isMobile) {
        // Prevent non-numeric input on desktop
        if (e.keyCode < 48 || e.keyCode > 57) {
          if (e.keyCode < 96 || e.keyCode > 105) {
            e.preventDefault();
          }
        }
      }
    }, { passive: false });
    
    // Load existing value and convert if needed (for form restoration)
    if (dobInput.value) {
      // If value is in YYYY-MM-DD format, convert to DD/MM/YYYY
      const isoMatch = dobInput.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (isoMatch) {
        dobInput.value = `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
        if (dobFormatted) dobFormatted.value = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`; // Keep ISO format
      } else {
        // If already in DD/MM/YYYY format, convert to ISO for hidden field
        const parts = dobInput.value.split('/');
        if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
          if (dobFormatted) dobFormatted.value = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
    }
  }
  
  // Standardize IVA provider select for consistent mobile experience
  const ivaProviderSelect = document.getElementById('iva-provider');
  if (ivaProviderSelect) {
    // Ensure select has proper mobile-friendly attributes
    ivaProviderSelect.setAttribute('autocomplete', 'off');
    
    // Add visual feedback class for styling (doesn't interfere with native behavior)
    ivaProviderSelect.addEventListener('focus', function() {
      this.classList.add('is-focused');
    }, { passive: true });
    
    ivaProviderSelect.addEventListener('blur', function() {
      this.classList.remove('is-focused');
    }, { passive: true });
  }

  // Capture UTM params immediately (lightweight)
  captureUtmFirstTouch();

  // Defer non-critical initialization
  requestIdleCallback(() => {
    // Turnstile container sanity check (remove duplicates)
    const allTurnstiles = document.querySelectorAll('.cf-turnstile');
    if (allTurnstiles.length > 1) {
      allTurnstiles.forEach(el => {
        if (el.id !== 'cf-container') {
          el.remove();
        }
      });
    }

    // Enforce submission lock on load (localStorage read - defer for mobile)
    (function enforceSubmissionLock(){
      try {
        const ts = Number(localStorage.getItem('ivaSubmittedAt') || 0);
        const cooldown = Number(localStorage.getItem('ivaSubmittedCooldownMs') || 0);
        const wantsReset = new URLSearchParams(location.search).has('reset');
        if (wantsReset) {
          localStorage.removeItem('ivaSubmittedAt');
          localStorage.removeItem('ivaSubmittedCooldownMs');
          return;
        }
        if (ts && cooldown && (Date.now() - ts) < cooldown) {
          // Hide the form and show thank-you instead
          const section = document.getElementById('form-section');
          if (section) section.classList.add('hidden');
          if (window.openThankYouModal) window.openThankYouModal();
        }
      } catch {}
    })();
  }, { timeout: 500 });

  


  // ===========================
  // Multi-step form wiring
  // ===========================
  steps = qsa(".form-step");
  initProgress();

  const form = qs("#iva-check-form");
  const formSection = qs("#form-section");

  // === Wire consent choice into hidden field on submit ===
  (function wireConsentToForm(){
    if (!form) return;
    const hidden = form.querySelector('input[name="consent_choice"]');
    if (!hidden) return;

    const setVal = () => {
      hidden.value = localStorage.getItem("vlm_cookie_consent") || "unset";
    };

    // initialise immediately
    setVal();

    // refresh right before submit - handled by unified forms controller
  })();


  function validateRequiredFieldsInCurrentStep() {
    let ok = true;
    const activeStep = qs(".form-step.active");
    if (!activeStep) return true;

    // 1) Inputs/selects/areas with [required]
    const fields = qsa("input[required], select[required], textarea[required]", activeStep)
      .filter(el => isVisible(el));

    fields.forEach(el => {
      // Skip radios/checkboxes here; handle as a group below
      if (el.type === "radio" || el.type === "checkbox") return;

      if (!String(el.value || "").trim()) {
        showError(el, el.getAttribute("data-error") || "This field is required");
        ok = false;
      } else {
        clearError(el);
      }
    });

    // 2) Radio groups: treat by [name]
    const radioNames = Array.from(new Set(
      qsa('input[type="radio"][required]', activeStep).map(r => r.name)
    ));

    radioNames.forEach(name => {
      const group = qsa(`input[type="radio"][name="${name}"]`, activeStep).filter(isVisible);
      if (!group.length) return;
      const isChecked = group.some(r => r.checked);

      // anchor the error near the first radio in the group
      const anchor = group[0];
      const labelErr = qs(`#${name}-error`) || getOrCreateErrorEl(anchor);
      if (!isChecked) {
        if (labelErr) {
          labelErr.id = `${name}-error`;
          labelErr.textContent = "Please make a selection";
          labelErr.style.display = "flex";
        }
        group.forEach(r => r.classList.add("input-error"));
        ok = false;
      } else if (labelErr) {
        labelErr.textContent = "";
        labelErr.style.display = "none";
        group.forEach(r => r.classList.remove("input-error"));
      }
    });

    return ok;
  }

  // Grabs (keep these near your other grabs)
  const phoneInput  = document.getElementById("phone_local");
  const phoneWrap   = document.querySelector("[data-phone]");
  const phoneHidden = document.getElementById("phone_e164");

  phoneInput?.addEventListener("blur", () => {
    const local = parseUKMobile(phoneInput.value);

    // If field is empty or just whitespace, don't scream yet
    if (!phoneInput.value.trim()) {
      clearError(phoneInput);
      phoneWrap?.classList.remove("error");
      phoneHidden.value = "";
      return;
    }

    if (!local) {
      showError(phoneInput, "Enter a valid UK mobile (7xxxxxxxxx)");
      phoneWrap?.classList.add("error");
      phoneHidden.value = "";
      return;
    }

    // Normalize UI to local format to match your +44 prefix
    phoneInput.value = local;               // shows e.g. 7123456789
    clearError(phoneInput);
    phoneWrap?.classList.remove("error");
    phoneHidden.value = `+44${local}`;      // e164 for Zapier
  });

  const headerMenus = document.querySelectorAll('.header-menu');
  if (headerMenus.length) {
    let lastY = window.scrollY;
    let menuScrollTimeout;

    window.addEventListener(
      'scroll',
      () => {
        if (menuScrollTimeout) return;
        menuScrollTimeout = requestAnimationFrame(() => {
          const currentY = window.scrollY;
          if (Math.abs(currentY - lastY) < 10) {
            menuScrollTimeout = null;
            return;
          }

          headerMenus.forEach(menu => {
            if (menu.hasAttribute('open')) {
              menu.removeAttribute('open');
            }
          });

          lastY = currentY;
          menuScrollTimeout = null;
        });
      },
      { passive: true }
    );
  }


  // Early submit guard - moved to unified forms controller
  // Form validation and submission now handled by forms.js


  // Step 1 validation: name and email quality checks
  function validateStep1() {
    let ok = true;
    const nameEl = qs("#fullName");
    const emailEl = qs("#email");
    const dobEl = qs("#dob");

    // Validate name
    if (nameEl) {
      const nameVal = nameEl.value.trim();
      if (!nameVal) {
        showError(nameEl, "Please enter your full name");
        ok = false;
      } else if (!isValidName(nameVal)) {
        showError(nameEl, "Please enter your full name (at least two words, 2-80 characters, letters only with optional hyphens or apostrophes)");
        ok = false;
      } else {
        clearError(nameEl);
      }
    }

    // Validate email
    if (emailEl) {
      const emailVal = emailEl.value.trim();
      if (!emailVal) {
        showError(emailEl, "Please enter your email address");
        ok = false;
      } else if (!isValidEmail(emailVal)) {
        showError(emailEl, "Please enter a valid email address");
        ok = false;
      } else {
        clearError(emailEl);
      }
    }

    // Validate DOB (now in DD/MM/YYYY format)
    if (dobEl) {
      const dobVal = dobEl.value.trim();
      if (!dobVal) {
        showError(dobEl, "Please enter your date of birth");
        ok = false;
      } else {
        // Check if it's a valid date format (DD/MM/YYYY)
        const parts = dobVal.split('/');
        if (parts.length !== 3 || parts[0].length !== 2 || parts[1].length !== 2 || parts[2].length !== 4) {
          showError(dobEl, "Please enter your date of birth in DD/MM/YYYY format");
          ok = false;
        } else {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          const year = parseInt(parts[2], 10);
          const today = new Date();
          
          // Validate date ranges
          if (year < 1900 || year > today.getFullYear()) {
            showError(dobEl, "Please enter a valid year");
            ok = false;
          } else if (month < 1 || month > 12) {
            showError(dobEl, "Please enter a valid month");
            ok = false;
          } else if (day < 1 || day > 31) {
            showError(dobEl, "Please enter a valid day");
            ok = false;
          } else {
            // Check if date is valid
            const date = new Date(year, month - 1, day);
            if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
              showError(dobEl, "Please enter a valid date");
              ok = false;
            } else if (date > today) {
              showError(dobEl, "Date of birth cannot be in the future");
              ok = false;
            } else {
              clearError(dobEl);
            }
          }
        }
      }
    }

    return ok;
  }

    // Run all validators for the current step; return true/false
    function runValidatorsForCurrentStep() {
      const validatorsByStep = [
        [validateStep1],  // Step 1 (index 0): contact & address
        [],               // Step 2 (index 1): IVA details (HTML required + radios)
        [],               // Step 3 (index 2): financial circumstances & route
        [validateConsent] // Step 4 (index 3): consent must be given
      ];
  
      const group = validatorsByStep[currentStep] || [];
      let ok = true;
  
      for (const fn of group) {
        if (!fn()) ok = false;
      }
  
      return ok;
    }
  



  // Step nav
  qsa(".next-btn").forEach(btn => on(btn, "click", () => {
    let ok = true;

    // Pass 1: required fields in this step
    if (!validateRequiredFieldsInCurrentStep()) ok = false;

    // Pass 2: step-specific validators (format/logic)
    if (!runValidatorsForCurrentStep()) ok = false;

    // If anything failed, scroll once and stop
    if (!ok) { scrollToFirstError(); return; }

    // Eligibility gate (only on the first step group)
    const ELIGIBILITY_STEP_INDEX = 0;
    if (currentStep === ELIGIBILITY_STEP_INDEX && isClientExcluded()) {
      showExclusionMessage();
      return;
    }

    // Advance
    goToStep(currentStep + 1);
    qs("#form-section")?.scrollIntoView({ behavior: "smooth" });

    // Track step reached (after goToStep, currentStep is the new index)
    const stepNum = currentStep + 1;
    if (stepNum >= 1 && stepNum <= 3) {
      trackStep(stepNum);
    }
  }));

  qsa(".prev-btn").forEach(btn => on(btn, "click", () => {
    goToStep(currentStep - 1);
    formSection?.scrollIntoView({ behavior: "smooth" });
  }));

  // Primary CTA buttons (include sticky footer button)
  ["start-check", "check", "check-iva", "resume-check", "open-iva"].forEach(id => {
    const b = qs(`#${id}`);
    on(b, "click", () => {
      formSection?.classList.remove("hidden");
      formSection?.scrollIntoView({ behavior: "smooth" });
      // hide the sticky bar immediately; IO will keep it in sync afterwards
      document.querySelector(".sticky-cta-footer")?.classList.add("is-hidden");
    });
  });

  // Auto-hide sticky CTA when form or footer is visible
  // Defer IntersectionObserver setup until after initial render for better mobile performance
  const stickyCTA = qs(".sticky-cta-footer");
  if (stickyCTA) {
    let formVisible = false;
    let footerVisible = false;

    const updateSticky = () => {
      if (formVisible || footerVisible) stickyCTA.classList.add("is-hidden");
      else stickyCTA.classList.remove("is-hidden");
    };

    // Defer observer setup to avoid blocking initial render
    requestIdleCallback(() => {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.target.id === "form-section") formVisible = entry.isIntersecting;
            if (entry.target.tagName.toLowerCase() === "footer") footerVisible = entry.isIntersecting;
          }
          updateSticky();
        },
        { root: null, rootMargin: "0px 0px -40% 0px", threshold: 0.01 }
      );

      const formEl = qs("#form-section");
      const footerEl = qs("footer");
      if (formEl) io.observe(formEl);
      if (footerEl) io.observe(footerEl);
    }, { timeout: 2000 });

    // Passive fallback so sticky hides while modals open/close
    ["click", "keyup"].forEach(ev => document.addEventListener(ev, updateSticky));
  }

  // Conditional bindings
  on(qs("#iva-provider"), "change", controllers.providerOther);
  on(qs("#residentialStatus"), "change", controllers.residentialOther);
  on(qs("#iva-provider"), "change", updateProviderDisplay);
  on(qs("#other-provider"), "input", updateProviderDisplay);


  qsa('input[name="livedAtAddress"]').forEach(r => on(r, "change", controllers.previousAddress));
  qsa('input[name="hadDependants"]').forEach(r => on(r, "change", controllers.dependants));
  qsa('input[name="signedElectronically"]').forEach(r => on(r, "change", controllers.signedOnPhone));
  qsa('input[name="ivaType"]').forEach(r => on(r, "change", controllers.ivaType));


  // Restore state (reapplies all conditionals once)
  // Defer form data restoration to avoid blocking initial render
  requestIdleCallback(() => {
    reapplyAllConditionalVisibility();
    loadFormData();
    updateProviderDisplay();
  }, { timeout: 1000 });

  on(form, "submit", async (e) => {
      e.preventDefault();

    // === Dev shortcuts ===
    const urlParams = new URLSearchParams(location.search);
    const isDev = urlParams.get('dev') === '1';
    const isBypass = isDev && urlParams.get('bypass') === '1';
    const isMock = isDev && urlParams.get('mock') === '1';
    const isAutofill = isDev && urlParams.get('autofill') === '1';

    // Auto-fill required fields with safe dummy values
    if (isAutofill) {
      const nameEl = qs("#fullName");
      const emailEl = qs("#email");
      const dobEl = qs("#dob");
      const phoneEl = qs("#phone_local");
      if (nameEl && !nameEl.value) nameEl.value = "John Smith";
      if (emailEl && !emailEl.value) emailEl.value = "test@example.com";
      if (dobEl && !dobEl.value) {
        dobEl.value = "01/01/1990";
        const dobFormatted = document.getElementById('dob-formatted');
        if (dobFormatted) dobFormatted.value = "1990-01-01";
      }
      if (phoneEl && !phoneEl.value) phoneEl.value = "7123456789";
      // Auto-select first radio option for required radio groups
      qsa('.form-step.active input[type="radio"][required]').forEach(radio => {
        const group = qsa(`input[name="${radio.name}"]`);
        if (group.length && !qsa(`input[name="${radio.name}"]:checked`).length) {
          group[0].checked = true;
        }
      });
    }

    // Mock mode: bypass Turnstile and network (no Lead event - only fires on real submit success)
    if (isMock) {
      if (isDev) console.log('[DEV] Mock mode: bypassing network, showing thank-you modal');

      // Simulate success
      localStorage.setItem("ivaSubmittedAt", String(Date.now()));
      localStorage.setItem("ivaSubmittedCooldownMs", "600000");
      localStorage.removeItem("ivaFormState");
      form.reset();
      steps.forEach(s => s.classList.remove("active"));
      qs('[data-step="0"]')?.classList.add("active");
      currentStep = 0;
      initProgress();
      goToStep(0);
      qs("#form-section")?.classList.remove("hidden");
      const excl = qs("#exclusion-modal");
      if (excl && excl.style) excl.style.display = "none";
      qsa('body > div[style*="position: fixed"][style*="z-index: 9998"]').forEach(el => el.remove());
      window.openThankYouModal && window.openThankYouModal();
      return;
    }

    // === Only allow submit on final step ===
    const lastStep = steps.length - 1;
    if (currentStep !== lastStep) {
      // If not on final step, advance instead
      let ok = true;
      if (!validateRequiredFieldsInCurrentStep()) ok = false;
      if (!runValidatorsForCurrentStep()) ok = false;
      if (!ok) { scrollToFirstError(); return; }
      goToStep(currentStep + 1);
      qs("#form-section")?.scrollIntoView({ behavior: "smooth" });
      // Track step reached (after goToStep, currentStep is the new index)
      const stepNum = currentStep + 1;
      if (stepNum >= 1 && stepNum <= 3) {
        trackStep(stepNum);
      }
      return;
    }

    // === NEW: stamp UTM fields ===
    stampUtmHiddenFields(form);
  

    // 1) Validate all fields before submit
    let ok = true;
    if (!validateRequiredFieldsInCurrentStep()) ok = false;
    if (!runValidatorsForCurrentStep()) ok = false;
    
    // Check Turnstile token on final step (skip in bypass mode)
    if (currentStep === steps.length - 1 && !isBypass) {
      const cfToken = qs("#cf_token");
      if (!cfToken || !cfToken.value.trim()) {
        const cfError = qs("#cf-turnstile-error");
        if (cfError) {
          cfError.textContent = "Please complete the verification.";
        }
        ok = false;
      } else {
        const cfError = qs("#cf-turnstile-error");
        if (cfError) cfError.textContent = "";
      }
    }
    
    if (!ok) { scrollToFirstError(); return; }

    // 2) Normalize phone (unchanged)
    const phoneEl = qs("#phone_local");
    if (phoneEl && isValidUKMobileLocal(phoneEl.value)) {
      const e164 = toE164UK(phoneEl.value);
      if (e164) qs("#phone_e164").value = e164;
    }

    updateProviderDisplay();

    // === NEW: stamp consent fields for Airtable ===
    const consentPicked = qs('input[name="consentGiven"]:checked')?.value || "";
    const nowIso = new Date().toISOString();

    const cw = qs("#consent_wording");
    const cv = qs("#consent_version");
    const ct = qs("#consent_timestamp_utc");
    const cg = qs("#consent_given");

    if (cw) cw.value = CONSENT_WORDING;
    if (cv) cv.value = CONSENT_VERSION;
    if (ct) ct.value = nowIso;
    if (cg) cg.value = consentPicked;

    // 3a) Resolve and validate the submit endpoint (Make webhook OR Netlify Function)
    // 3a) Resolve and validate the submit endpoint (Make webhook OR Netlify Function)
const endpoint = (form.getAttribute("action") || "").trim();

const isMake = /^https:\/\/hook\.[a-z0-9.-]+\.make\.com\/[A-Za-z0-9_-]+$/i.test(endpoint);
const isNetlifyFnRel = /^\/\.netlify\/functions\/[a-z0-9-]+$/i.test(endpoint);
const isNetlifyFnAbs = /^https?:\/\/[^/]+\/\.netlify\/functions\/[a-z0-9-]+$/i.test(endpoint);

// Allow /api/submit (relative and absolute)
const isApiSubmitRel = /^\/api\/submit\/?$/i.test(endpoint);
const isApiSubmitAbs = /^https?:\/\/[^/]+\/api\/submit\/?$/i.test(endpoint);

if (!(isMake || isNetlifyFnRel || isNetlifyFnAbs || isApiSubmitRel || isApiSubmitAbs)) {
  console.error("Missing or invalid submit endpoint:", endpoint);
  setSubmitting(false);
  // Error handling moved to unified forms controller
  return;
}



    // 3b) Prepare JSON body + headers
    // Generate eventId before fetch
    const eventId = (crypto?.randomUUID && crypto.randomUUID()) || String(Date.now());
    if (DEV) {
      console.log('[DEV] eventId', eventId);
      if (window.updateDebugState) window.updateDebugState('lastEventId', eventId);
    }

    const fd = new FormData(form);

    // Convert FormData → plain object (fields only, no top-level metadata)
    const fields = Object.fromEntries(fd.entries());
    
    // Ensure DOB is in ISO format (YYYY-MM-DD) for backend
    // The hidden field with name="dob" should already have the correct value
    // but we ensure it's set correctly as a safeguard
    const dobFormattedEl = document.getElementById('dob-formatted');
    const dobDisplayEl = document.getElementById('dob');
    if (dobFormattedEl && dobFormattedEl.value) {
      fields.dob = dobFormattedEl.value; // Use ISO format from hidden field
    } else if (dobDisplayEl && dobDisplayEl.value) {
      // Fallback: convert display format to ISO if hidden field not set
      const parts = dobDisplayEl.value.split('/');
      if (parts.length === 3) {
        fields.dob = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    
    // Remove the display field from submission (not needed by backend)
    delete fields['dob-display'];

    // Extract Turnstile token reliably
    // Prefer FormData field, then check DOM element
    let turnstileToken = fields['cf-turnstile-response'] || fields['cf_turnstile_token'] || '';
    if (!turnstileToken) {
      const cfTokenEl = qs("#cf_token");
      if (cfTokenEl) turnstileToken = cfTokenEl.value || '';
    }
    if (!turnstileToken) {
      const cfInput = document.querySelector('input[name="cf-turnstile-response"]');
      if (cfInput) turnstileToken = cfInput.value || '';
    }

    if (DEV) {
      console.log('[DEV] Turnstile token extracted:', turnstileToken ? 'yes' : 'no', turnstileToken ? turnstileToken.substring(0, 20) + '...' : '');
    }

    // Build payload matching backend expectations
    const payload = {
      formId: form.id || 'iva-check-form',
      fields,
      turnstileToken: turnstileToken || "",
      sourceUrl: location.href,
      userAgent: navigator.userAgent || "",
      eventId
    };

    // Build endpoint URL (append bypass params if needed)
    let submitUrl = endpoint;
    if (isBypass) {
      try {
        // Handle both relative and absolute URLs
        const url = submitUrl.startsWith('http') 
          ? new URL(submitUrl)
          : new URL(submitUrl, location.origin);
        url.searchParams.set('dev', '1');
        url.searchParams.set('bypass', '1');
        submitUrl = submitUrl.startsWith('http') 
          ? url.href 
          : url.pathname + url.search;
      } catch (e) {
        // Fallback: append query params manually
        const separator = submitUrl.includes('?') ? '&' : '?';
        submitUrl = submitUrl + separator + 'dev=1&bypass=1';
      }
      if (DEV) console.log('[DEV] Bypass mode: submit URL:', submitUrl);
    }

    const body = JSON.stringify(payload);
    const headers = { "Content-Type": "application/json;charset=UTF-8" };

    // Add debug key header for bypass mode
    if (isBypass) {
      const debugKey = window.ENV?.DEBUG_BYPASS_KEY || "";
      if (!debugKey) {
        console.error('[DEV] Bypass mode requires DEBUG_BYPASS_KEY in window.ENV');
        if (window.updateDebugState) window.updateDebugState('lastError', 'Bypass mode: DEBUG_BYPASS_KEY missing');
        setSubmitting(false);
        return;
      }
      headers['x-debug-key'] = debugKey;
      if (DEV) console.log('[DEV] Bypass mode: added debug key header');
    }

    // 4) UX: show loader before network step
    setSubmitting(true);
    if (DEV && window.updateDebugState) {
      window.updateDebugState('lastSubmitStatus', 'submitting...');
      window.updateDebugState('lastError', null);
      window.updateDebugState('lastBackendCode', null);
    }

    try {
      // Send using a normal fetch (no-cors removed – same-origin OK)
      const res = await fetch(submitUrl, {
        method: "POST",
        headers,
        body,
        keepalive: true
      });

      // Parse response
      let responseData = null;
      try {
        responseData = await res.json();
      } catch {
        responseData = { ok: false, message: "Invalid JSON response" };
      }

      // Update debug state
      if (DEV && window.updateDebugState) {
        window.updateDebugState('lastSubmitStatus', res.ok ? 'success' : 'failed');
        if (responseData.code) window.updateDebugState('lastBackendCode', responseData.code);
        if (!res.ok || !responseData.ok) {
          window.updateDebugState('lastError', responseData.message || `HTTP ${res.status}`);
        }
      }

      // ❌ If API rejects (400/422/500/etc)
      if (!res.ok) {
        console.error("Submit failed:", res.status, responseData);
        if (DEV) {
          console.error('[DEV] Backend response:', responseData);
        }
        setSubmitting(false);
        return;
      }

      // ✅ Only on successful submit (res.ok and { ok: true })
      if (res.ok && responseData?.ok) {
        // Fire Lead event ONLY on successful submit with deduplication
        const leadKey = `lead_fired_${eventId}`;
        if (!sessionStorage.getItem(leadKey)) {
          try {
            if (typeof window.fbq === 'function') {
              window.fbq('track', 'Lead', {}, { eventID: eventId });
              sessionStorage.setItem(leadKey, 'true');
              if (DEV) {
                console.log('[DEV] Lead fired:', eventId);
                if (window.updateDebugState) window.updateDebugState('lastError', null);
              }
            } else if (DEV) {
              console.warn('[DEV] fbq not available - Lead event not fired');
              if (window.updateDebugState) window.updateDebugState('lastError', 'fbq not available');
            }
          } catch (err) {
            if (DEV) {
              console.error('[DEV] Lead failed:', err);
              if (window.updateDebugState) window.updateDebugState('lastError', 'Lead fire failed: ' + String(err));
            }
          }
        } else if (DEV) {
          console.log('[DEV] Lead already fired for eventId:', eventId);
        }

    localStorage.setItem("ivaSubmittedAt", String(Date.now()));
    localStorage.setItem("ivaSubmittedCooldownMs", "600000"); // 10 minutes
    localStorage.removeItem("ivaFormState");

    // Reset form + steps
    form.reset();
    steps.forEach(s => s.classList.remove("active"));
    qs('[data-step="0"]')?.classList.add("active");
    currentStep = 0;
    initProgress();
    goToStep(0);

    qs("#form-section")?.classList.remove("hidden");
    const excl = qs("#exclusion-modal");
    if (excl && excl.style) excl.style.display = "none";
    qsa('body > div[style*="position: fixed"][style*="z-index: 9998"]').forEach(el => el.remove());

    // Fire thank-you modal (Lead already fired above)
    window.openThankYouModal && window.openThankYouModal();
  } else {
    console.error("Submit failed:", responseData);
    setSubmitting(false);
  }

} catch (err) {
  console.error("Submit error:", err);
} finally {
  setSubmitting(false);
}
});


  // === Cookies / Consent ===
(function () {
  const COOKIE_KEY = "vlm_cookie_consent"; // 'accepted' | 'rejected'
  const GA_ID = "G-QCBEHKT1TP";

  // Boot async so we can await injection safely
  // Defer cookie banner initialization to avoid blocking initial render
  requestIdleCallback(async () => {
    // 1) Ensure banner HTML exists before we query anything
    await ensureCookieBanner();

    // 2) Query banner after injection (if any)
    let banner = document.getElementById("cookie-banner");

    // 3) Respect existing choice
    const choice = localStorage.getItem(COOKIE_KEY);
    if (!choice) {
      // first visit → show banner
      banner?.classList.remove("hidden");
      document.body.classList.add("has-cookie-banner");
    } else if (choice === "accepted") {
      loadGA();
      // Meta Pixel already loads automatically on page load if consent is accepted
      // No need to call checkMetaPixelConsent here - it's already been called by initMetaPixel()
    }
  }, { timeout: 2000 });

  // Delegated clicks so buttons work even if banner was injected after load
  document.addEventListener("click", (e) => {
    const accept = e.target.closest(
      '#accept-cookies, #cookie-accept, .cookie-accept, [data-accept="cookies"]'
    );
    const reject = e.target.closest(
      '#reject-cookies, #cookie-reject, .cookie-reject, [data-reject="cookies"]'
    );

    if (!accept && !reject) return;

    e.preventDefault();

    const banner = document.getElementById("cookie-banner");

    if (accept) {
      try { localStorage.setItem(COOKIE_KEY, "accepted"); } catch {}
      banner?.classList.add("hidden");
      document.body.classList.remove("has-cookie-banner");
      loadGA();
    
      // Load Meta Pixel after consent (ViewContent fires automatically in initMetaPixel)
      if (typeof window.checkMetaPixelConsent === 'function') {
        window.checkMetaPixelConsent();
      }
    }    
    if (reject) {
      try { localStorage.setItem(COOKIE_KEY, "rejected"); } catch {}
      banner?.classList.add("hidden");
      document.body.classList.remove("has-cookie-banner");
      // Do not load GA
      resetAnalytics(); // optional but nice to keep state clean
    }
  });

  // “Manage settings” should reopen banner consistently
  document.addEventListener("click", async (e) => {
    const target = e.target.closest(
      '#change-cookie-settings, .change-cookie-settings, [data-action="change-cookie-settings"], #cookie-manage'
    );
    if (!target) return;

    e.preventDefault();

    try { localStorage.removeItem(COOKIE_KEY); } catch {}
    if (typeof resetAnalytics === "function") resetAnalytics();
    if (window.App?.Modal?.closeAll) window.App.Modal.closeAll();

    await ensureCookieBanner();

    const banner = document.getElementById("cookie-banner");
    banner?.classList.remove("hidden");
    document.body.classList.add("has-cookie-banner");

    // Focus primary action
    const primary = document.querySelector(
      '#cookie-banner #accept-cookies, #cookie-banner #cookie-accept'
    );
    primary?.focus?.({ preventScroll: true });
  });

  // Inject banner partial once (idempotent). Returns banner element or null.
  async function ensureCookieBanner() {
    let banner = document.getElementById("cookie-banner");
    if (banner) return banner;

    try {
      const res = await fetch("/partials/cookie-banner.html", { cache: "no-cache" });
      if (res.ok) {
        const html = await res.text();
        document.body.insertAdjacentHTML("beforeend", html);
        banner = document.getElementById("cookie-banner");
      }
    } catch (err) {
      // swallow — site still works without banner HTML
      console.warn("Cookie banner injection failed:", err);
    }
    return banner;
  }

  // Load GA only after explicit consent
  function loadGA() {
    if (window.__gaLoaded) return;
    window.__gaLoaded = true;

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(s);

    s.onload = () => {
      window.dataLayer = window.dataLayer || [];
      function gtag(){ dataLayer.push(arguments); }
      window.gtag = gtag;

      gtag("js", new Date());
      gtag("config", GA_ID);
    };
  }

  // Best-effort analytics reset (GA + Meta)
function resetAnalytics() {
  const host = location.hostname;
  const root = host.split(".").slice(-2).join(".");

  const expire = (name, domain) => {
    document.cookie = `${name}=; Max-Age=0; path=/; ${domain ? `domain=${domain};` : ""} SameSite=Lax`;
  };

  // -----------------------------
  // GA / gtag reset
  // -----------------------------
  try {
    if (typeof gtag === "function") {
      gtag("consent", "update", { analytics_storage: "denied" });
    }
  } catch {}

  // Remove gtag loader scripts (optional, but fine)
  document
    .querySelectorAll('script[src*="googletagmanager.com/gtag/js"]')
    .forEach((s) => s.remove());

  // Expire GA cookies
  const gaNames = ["_ga", `_ga_${GA_ID.replace("G-","")}`, "_gid", "_gcl_au"];
  gaNames.forEach((n) => {
    expire(n);
    expire(n, `.${root}`);
    expire(n, `.${host}`);
  });

  // Reset in-memory GA globals
  try { delete window.gtag; } catch { window.gtag = undefined; }
  window.dataLayer = [];
  window.__gaLoaded = false;

  // -----------------------------
  // Meta Pixel reset (SAFE)
  // -----------------------------
  // IMPORTANT: Do NOT delete fbq or remove connect.facebook.net scripts.
  // Doing so can trigger Meta "conflicting versions" warnings on re-consent.
  try {
    // Allow your pageview/viewcontent to fire again if user re-consents later
    delete window.__vlm_pageview_fired;
    delete window.__vlm_ivaview_fired;
  } catch {}

  // Expire Meta cookies
  ["_fbp", "_fbc"].forEach((n) => {
    expire(n);
    expire(n, `.${root}`);
    expire(n, `.${host}`);
  });

  // Optional: if your own code uses this as the source of truth
  // (adjust the key if your banner uses a different name)
  try {
    localStorage.setItem("vlm_cookie_consent", "denied");
  } catch {}
}
})();

  
// Modal bindings are now handled by /js/modal-runtime.js via window.App.Modal.bindTriggers()


  // ===========================
  // Thank-you modal + Dev reset
  // ===========================
  on(qs("#close-thank-you"), "click", () => {
    const m = qs("#thank-you");
    m?.classList.add("hidden");
    m?.classList.remove("show");
  });

  on(qs("#dev-reset"), "click", () => {
    localStorage.removeItem("ivaFormState");
    sessionStorage.clear();
    form.reset();

    reapplyAllConditionalVisibility();

    formSection?.classList.remove("hidden");
    qs("#thank-you")?.classList.add("hidden");
    const excl = qs("#exclusion-modal"); if (excl && excl.style) excl.style.display = "none";
    qsa('body > div[style*="position: fixed"][style*="z-index: 9998"]').forEach(el => el.remove());

    steps.forEach(s => s.classList.remove("active"));
    qs('[data-step="0"]')?.classList.add("active");
    currentStep = 0;
    initProgress();
    goToStep(0);

    // Form reset notification handled by unified forms controller
  });

  // Smooth scroll for "Start your free check" link
  const scrollLink = document.getElementById("scroll-to-form");

  if (scrollLink && formSection) {
    scrollLink.addEventListener("click", (e) => {
      e.preventDefault();
      formSection.scrollIntoView({ behavior: "smooth" });
    });
  }
}); // End of DOMContentLoaded

// === Premium auto-hide header (direction-aware + gentle shrink) ===
// Defer initialization until after initial render
(() => {
  const siteHeader = document.querySelector('.site-header');
  if (!siteHeader) return;

  let lastY = window.scrollY;
  let hidden = false;
  let shrunk = false;
  let headerScrollTimeout;

  const SHRINK_AT = 80;
  const HIDE_AT   = 120;
  const DELTA     = 4;

  // Defer scroll listener setup until after initial render
  requestIdleCallback(() => {
    window.addEventListener('scroll', () => {
      if (headerScrollTimeout) return;
      headerScrollTimeout = requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;

        const shouldShrink = y > SHRINK_AT;
        if (shouldShrink !== shrunk) {
          siteHeader.classList.toggle('shrink', shouldShrink);
          shrunk = shouldShrink;
        }

        if (Math.abs(dy) > DELTA) {
          const goingDown = dy > 0;
          const shouldHide = goingDown && y > HIDE_AT;
          if (shouldHide !== hidden) {
            siteHeader.classList.toggle('is-hidden', shouldHide);
            hidden = shouldHide;
          }
        }

        lastY = y;
        headerScrollTimeout = null;
      });
    }, { passive: true });
  }, { timeout: 1000 });
})();

// (keep) lucide icons (safe) - defer until after initial render
requestIdleCallback(() => {
  try { 
    if (window.lucide?.createIcons) window.lucide.createIcons(); 
  } catch {}
}, { timeout: 1500 });

// ============================================================
// DEV MODE TEST HARNESS
// ============================================================
if (DEV) {
  window.vlmDebug = {
    // Fire Lead event manually (for testing)
    fireLead: function(eventId) {
      eventId = eventId || (crypto?.randomUUID && crypto.randomUUID()) || String(Date.now());
      const leadKey = `lead_fired_${eventId}`;
      if (!sessionStorage.getItem(leadKey)) {
        if (typeof window.fbq === 'function') {
          window.fbq('track', 'Lead', {}, { eventID: eventId });
          sessionStorage.setItem(leadKey, 'true');
          console.log('[DEV] Manual Lead fired:', eventId);
          return { success: true, eventId };
        } else {
          console.warn('[DEV] fbq not available');
          return { success: false, error: 'fbq not available' };
        }
      } else {
        console.log('[DEV] Lead already fired for eventId:', eventId);
        return { success: false, error: 'already fired' };
      }
    },

    // Check pixel status
    checkPixel: function() {
      const status = {
        consent: localStorage.getItem('vlm_cookie_consent') || 'not set',
        hasFbq: typeof window.fbq === 'function',
        fbqLoaded: window.fbq?.loaded || false,
        inited: window.__vlm_pixel_inited || false,
        pageviewFired: window.__vlm_eventsFired?.pageview || false,
        viewcontentFired: window.__vlm_eventsFired?.viewcontent || false
      };
      console.log('[DEV] Pixel status:', status);
      return status;
    },

    // Simulate successful submit (for testing)
    simulateSuccess: function(eventId) {
      eventId = eventId || (crypto?.randomUUID && crypto.randomUUID()) || String(Date.now());
      console.log('[DEV] Simulating successful submit with eventId:', eventId);
      
      // Fire Lead
      this.fireLead(eventId);
      
      // Open thank-you modal
      if (typeof window.openThankYouModal === 'function') {
        window.openThankYouModal();
      }
      
      return { success: true, eventId };
    },

    // Get current debug state
    getState: function() {
      return { ...debugState };
    }
  };

  console.log('[DEV] Test harness available: window.vlmDebug');
  console.log('[DEV] Usage:');
  console.log('  - vlmDebug.fireLead(eventId) - Fire Lead event');
  console.log('  - vlmDebug.checkPixel() - Check pixel status');
  console.log('  - vlmDebug.simulateSuccess(eventId) - Simulate successful submit');
  console.log('  - vlmDebug.getState() - Get current debug state');
}