// src/js/forms.js — Visible Legal Marketing forms controller v2.0
// Invisible spam protection with behavioral analysis
(() => {
  if (window.__FORMS_BOOTED__) return;
  window.__FORMS_BOOTED__ = true;

  const API_ENDPOINT = "/api/submit";

  // ═══════════════════════════════════════════════════════════════
  // FORM-SPECIFIC CONFIGURATION — mobile-optimized thresholds
  // ═══════════════════════════════════════════════════════════════
  const FORM_CONFIG = {
    'bec-claim-form': {
      name: 'BEC',
      thresholds: {
        minInteractions: 8,
        minKeystrokes: 15,
        minFieldFocuses: 3,
        minTimeOnPage: 20,
        maxPasteRatio: 0.7,
        minFormChanges: 5
      }
    },
    'iva-claim-form': {
      name: 'IVA',
      thresholds: {
        minInteractions: 10,
        minKeystrokes: 25,
        minFieldFocuses: 5,
        minTimeOnPage: 35,
        maxPasteRatio: 0.6,
        minFormChanges: 7
      }
    },
    'claimForm': {
      name: 'Query',
      thresholds: {
        minInteractions: 5,
        minKeystrokes: 10,
        minFieldFocuses: 2,
        minTimeOnPage: 10,
        maxPasteRatio: 0.8,
        minFormChanges: 3
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // BEHAVIORAL TRACKING
  // ═══════════════════════════════════════════════════════════════
  const formBehavior = new Map();

  function initBehaviorTracking(form, formId) {
    const behavior = {
      interactions: 0,
      keystrokes: 0,
      fieldFocuses: 0,
      pasteEvents: 0,
      formChanges: 0,
      startTime: Date.now(),
      fieldsPasted: new Set(),
      fieldsChanged: new Set()
    };

    formBehavior.set(formId, behavior);

    // Track interactions (touch + click for mobile)
    const trackInteraction = () => behavior.interactions++;
    document.addEventListener('click', trackInteraction, { passive: true });
    document.addEventListener('touchstart', trackInteraction, { passive: true });

    // Track keystrokes
    form.addEventListener('keydown', () => behavior.keystrokes++, { passive: true });

    // Track field interactions
    form.querySelectorAll('input, select, textarea').forEach(field => {
      if (field.type === 'hidden' || field.closest('.ohnohoney')) return;

      field.addEventListener('focus', () => {
        behavior.fieldFocuses++;
      }, { passive: true });

      field.addEventListener('paste', () => {
        behavior.pasteEvents++;
        behavior.fieldsPasted.add(field.name);
      }, { passive: true });

      field.addEventListener('change', () => {
        behavior.fieldsChanged.add(field.name);
        behavior.formChanges = behavior.fieldsChanged.size;
      }, { passive: true });

      if (['text', 'email', 'tel'].includes(field.type) || field.tagName === 'TEXTAREA') {
        field.addEventListener('input', () => {
          behavior.fieldsChanged.add(field.name);
          behavior.formChanges = behavior.fieldsChanged.size;
        }, { passive: true });
      }
    });

    console.log(`[Behavior] Tracking initialized for ${formId}`);
  }

  function getBehaviorScore(formId) {
    const behavior = formBehavior.get(formId);
    if (!behavior) return null;

    const timeOnPage = Math.floor((Date.now() - behavior.startTime) / 1000);
    const totalFields = behavior.fieldsChanged.size + behavior.fieldsPasted.size;
    const pasteRatio = totalFields > 0 ? behavior.fieldsPasted.size / totalFields : 0;

    return {
      interactions: behavior.interactions,
      keystrokes: behavior.keystrokes,
      fieldFocuses: behavior.fieldFocuses,
      pasteEvents: behavior.pasteEvents,
      formChanges: behavior.formChanges,
      timeOnPage,
      pasteRatio: Math.round(pasteRatio * 100) / 100
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FORM SUBMISSION
  // ═══════════════════════════════════════════════════════════════
  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const formId = form.id || 'unknown-form';

    if (form.dataset.submitting === '1') return;

    clearMessages(form);

    try {
      setSubmitting(form, true);

      const behaviorScore = getBehaviorScore(formId);
      console.log(`[Submit] ${formId}`, behaviorScore);

      const fields = formToObject(form);
      // Use VLMPixel's session-stable eventId so browser pixel and CAPI share the same ID
      const eventId = (window.VLMPixel ? window.VLMPixel.getEventId() : null)
                      || crypto?.randomUUID?.()
                      || String(Date.now());

      const payload = {
        formId,
        fields,
        behaviorScore,
        sourceUrl: location.href,
        userAgent: navigator.userAgent,
        eventId
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(form.action || API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);

      let data = null;
      try { data = await res.json(); } catch {}

      if (!res.ok || !data?.ok) {
        const msg = data?.message || data?.error || 'Sorry, we couldn\'t submit your form. Please try again.';
        console.error('[Submit] Error', res.status, data);
        showError(form, msg);
        setSubmitting(form, false);
        return;
      }

      // ── Success ──────────────────────────────────────────────────────────
      console.log('[Submit] Success', eventId);
      form.reset();
      form.classList.add('submitted');

      // Fire browser-side Meta Lead pixel (CAPI already fired server-side in submit.js)
      // Both use the same eventId so Meta deduplicates correctly
      try {
        if (window.VLMPixel) {
          var firedEventId = window.VLMPixel.trackLead();
          console.debug('[Forms] Meta Lead tracked, eventId:', firedEventId);
        }
      } catch(pixelErr) {
        console.warn('[Forms] Pixel fire failed (non-fatal):', pixelErr);
      }

      var modal = document.getElementById('thank-you');
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('show', 'fade-in');
        modal.setAttribute('aria-hidden', 'false');

        try {
          var steps = form.querySelectorAll('.form-step');
          steps.forEach(function(s) { s.classList.remove('active'); });
          var first = form.querySelector('.form-step[data-step="0"]');
          if (first) first.classList.add('active');

          var bar = document.getElementById('progress-bar');
          var lab = document.getElementById('progress-label');
          if (bar) bar.style.width = (100 / (steps.length || 4)) + '%';
          if (lab) lab.textContent = 'Step 1 of ' + (steps.length || 4);
        } catch(e) {}
      } else {
        showSuccess(form, 'Thank you! We\'ve received your submission.');
      }

      // Dispatch event for any other listeners
      try {
        window.dispatchEvent(new CustomEvent('vlm:form-submitted', { detail: { ok: true, formId: formId, eventId: eventId } }));
      } catch(e) {}

      setSubmitting(form, false);

    } catch (err) {
      console.error('[Submit] Network error', err);
      showError(form, 'Network error. Please check your connection and try again.');
      setSubmitting(form, false);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════
  function formToObject(form) {
    const fd = new FormData(form);
    const obj = {};
    for (const [k, v] of fd.entries()) {
      if (k === 'company_website') continue; // Skip honeypot
      obj[k] = obj[k] ? [].concat(obj[k], v) : v;
    }
    return obj;
  }

  function setSubmitting(form, isSubmitting) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) {
      form.dataset.submitting = isSubmitting ? '1' : '';
      return;
    }
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = (btn.textContent || '').trim();
    }
    const loadingText = btn.getAttribute('data-loading-text') || 'Submitting\u2026';
    btn.disabled = !!isSubmitting;
    btn.setAttribute('aria-busy', String(!!isSubmitting));
    form.dataset.submitting = isSubmitting ? '1' : '';
    btn.textContent = isSubmitting ? loadingText : btn.dataset.originalText;
  }

  function clearMessages(form) {
    const err = form.querySelector('.form-error');
    const suc = form.querySelector('.success-message');
    if (err) { err.classList.add('hidden'); err.textContent = ''; err.style.display = ''; }
    if (suc) { suc.classList.add('hidden'); suc.textContent = ''; suc.style.display = ''; }
  }

  function showError(form, msg) {
    let el = form.querySelector('.form-error');
    if (!el) {
      el = document.createElement('p');
      el.className = 'form-error';
      el.setAttribute('role', 'alert');
      const actions = form.querySelector('.form-actions') || form;
      actions.appendChild(el);
    }
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showSuccess(form, msg) {
    let el = form.querySelector('.success-message');
    if (!el) {
      el = document.createElement('p');
      el.className = 'success-message';
      el.setAttribute('role', 'status');
      const actions = form.querySelector('.form-actions') || form;
      actions.appendChild(el);
    }
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════
  function init() {
    const forms = document.querySelectorAll('form[data-protect="true"], form[data-form]');
    forms.forEach(form => {
      const formId = form.id || 'unknown-form';
      if (form.dataset.bound === '1') return;

      initBehaviorTracking(form, formId);
      form.addEventListener('submit', handleSubmit, { passive: false });
      form.dataset.bound = '1';

      console.log(`[Forms] Initialized ${formId}`);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
