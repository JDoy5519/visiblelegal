/* =========================================================
   VLM / BEC Landing Page — script.js
   - Simple single-step form UX
   - Phone validation, supplier toggle, UTM capture
   - Turnstile & consent validation
   ========================================================= */

(function () {
  'use strict';

  // ---------- DOM refs ----------
  const form = document.getElementById('bec-check-form');
  if (!form) return;

  const supplierSelect = document.getElementById('energySupplier');
  const otherGroup = document.getElementById('otherSupplierGroup');
  const otherInput = document.getElementById('otherSupplier');
  const phoneInput = document.getElementById('phone');
  const consentBox = document.getElementById('contactConsent');
  const submitBtn = document.getElementById('submitBtn');

  // ---------- "Other" supplier toggle ----------
  if (supplierSelect && otherGroup) {
    supplierSelect.addEventListener('change', function () {
      if (this.value === 'Other') {
        otherGroup.classList.remove('hidden');
        if (otherInput) otherInput.setAttribute('required', 'required');
      } else {
        otherGroup.classList.add('hidden');
        if (otherInput) {
          otherInput.removeAttribute('required');
          otherInput.value = '';
        }
      }
    });
  }

  // ---------- Phone normalisation (UK → E.164) ----------
  function normalisePhone(raw) {
    let digits = raw.replace(/[^0-9+]/g, '');

    // Strip leading +44 and treat as local
    if (digits.startsWith('+44')) digits = '0' + digits.slice(3);
    else if (digits.startsWith('44') && digits.length > 10) digits = '0' + digits.slice(2);

    return digits;
  }

  function isValidUKPhone(digits) {
    return /^0[1-9]\d{8,9}$/.test(digits);
  }

  // ---------- Error helpers ----------
  function getOrCreateErrorEl(input) {
    if (!input || !input.id) return null;
    let err = document.getElementById(input.id + '-error');
    if (!err) {
      err = document.createElement('p');
      err.id = input.id + '-error';
      err.className = 'error-message';
      err.setAttribute('role', 'alert');
      err.setAttribute('aria-live', 'polite');
      input.insertAdjacentElement('afterend', err);
    }
    return err;
  }

  function showError(input, message) {
    if (!input) return;
    const err = getOrCreateErrorEl(input);
    if (err) err.textContent = message || '';
    input.classList.add('input-error');
    input.setAttribute('aria-invalid', 'true');
  }

  function clearError(input) {
    if (!input) return;
    const err = getOrCreateErrorEl(input);
    if (err) err.textContent = '';
    input.classList.remove('input-error');
    input.removeAttribute('aria-invalid');
  }

  // ---------- UTM capture ----------
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

  function captureUtms() {
    const params = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach(function (k) {
      const v = params.get(k);
      if (v) sessionStorage.setItem(k, v);
    });
  }

  function stampUtmFields() {
    UTM_KEYS.forEach(function (k) {
      const el = document.getElementById(k);
      if (el) el.value = sessionStorage.getItem(k) || new URLSearchParams(location.search).get(k) || '';
    });

    const srcUrl = document.getElementById('source_url');
    if (srcUrl) srcUrl.value = location.href.split('#')[0];
  }

  // ---------- Honeypot timestamp ----------
  function stampFormStarted() {
    const el = document.getElementById('form_started_at_bec');
    if (el && !el.value) el.value = new Date().toISOString();
  }

  // ---------- Validation ----------
  function validateForm() {
    let valid = true;

    // Required text fields
    var requiredFields = form.querySelectorAll('input[required], select[required], textarea[required]');
    requiredFields.forEach(function (field) {
      if (field.type === 'checkbox') return; // handled separately
      clearError(field);
      if (!field.value.trim()) {
        showError(field, 'This field is required.');
        valid = false;
      }
    });

    // Phone
    if (phoneInput) {
      clearError(phoneInput);
      var digits = normalisePhone(phoneInput.value);
      if (!digits) {
        showError(phoneInput, 'Please enter your phone number.');
        valid = false;
      } else if (!isValidUKPhone(digits)) {
        showError(phoneInput, 'Please enter a valid UK phone number (e.g. 07123 456789).');
        valid = false;
      }
    }

    // Email basic check
    var emailInput = document.getElementById('email');
    if (emailInput && emailInput.value) {
      clearError(emailInput);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
        showError(emailInput, 'Please enter a valid email address.');
        valid = false;
      }
    }

    // Consent
    if (consentBox && !consentBox.checked) {
      showError(consentBox, 'You must agree to the terms to proceed.');
      valid = false;
    } else if (consentBox) {
      clearError(consentBox);
    }

    return valid;
  }

  // ---------- Scroll to first error ----------
  function scrollToFirstError() {
    var target = form.querySelector('.input-error');
    if (!target) return;

    var header = document.querySelector('.site-header');
    var headerH = header ? header.getBoundingClientRect().height : 0;

    requestAnimationFrame(function () {
      var y = target.getBoundingClientRect().top + window.pageYOffset - (headerH + 16);
      window.scrollTo({ top: y, behavior: 'smooth' });
      if (typeof target.focus === 'function') target.focus({ preventScroll: true });
    });
  }

  // ---------- Phone normalisation on submit ----------
  function normalisePhoneBeforeSubmit() {
    if (!phoneInput) return;
    var digits = normalisePhone(phoneInput.value);
    if (isValidUKPhone(digits)) {
      // Convert to E.164 for backend
      phoneInput.value = '+44' + digits.slice(1);
    }
  }

  // ---------- Init ----------
  captureUtms();

  // Stamp hidden fields on first interaction
  form.addEventListener('focusin', function () {
    stampUtmFields();
    stampFormStarted();
  }, { once: true });

  // Real-time clearing on input
  form.addEventListener('input', function (e) {
    if (e.target.classList.contains('input-error')) {
      clearError(e.target);
    }
  });

  // GA form start tracking
  form.addEventListener('focusin', function () {
    if (window._becFormStarted) return;
    window._becFormStarted = true;
    if (typeof gtag === 'function') {
      gtag('event', 'form_start', { form_id: 'bec_check' });
    }
  }, { once: false });

  // The actual submission is handled by /src/js/forms.js (universal handler).
  // We just need to validate before it fires.
  // forms.js listens for submit and sends JSON to /api/submit.
  // We hook into the form's submit event to validate first.

  form.addEventListener('submit', function (e) {
    // Validate before forms.js takes over
    if (!validateForm()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      scrollToFirstError();
      return;
    }

    // Normalise phone to E.164
    normalisePhoneBeforeSubmit();

    // Stamp UTMs one final time
    stampUtmFields();
  }, { capture: true }); // capture phase so we run before forms.js

})();
