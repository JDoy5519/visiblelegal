// src/js/forms.js — unified forms controller
(() => {
  // Boot once
  if (window.__FORMS_BOOTED__) return;
  window.__FORMS_BOOTED__ = true;

  const API_ENDPOINT = "/api/submit";
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function formToObject(form) {
    const fd = new FormData(form);
    const obj = {};
    for (const [k, v] of fd.entries()) {
      obj[k] = obj[k] ? [].concat(obj[k], v) : v;
    }
    return obj;
  }

  async function postWithRetry(url, options, retries = 1) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(t);
      return resp;
    } catch (err) {
      if (retries > 0) {
        await sleep(300);
        return postWithRetry(url, options, retries - 1);
      }
      throw err;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindFormsOnce();
  });

  function bindFormsOnce() {
    const forms = document.querySelectorAll('form[data-protect="true"], form[data-form]');
    forms.forEach((form) => {
      if (form.dataset.bound === '1') return;
      form.addEventListener('submit', handleSubmit, { passive: false });
      form.dataset.bound = '1';
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;

    // Prevent double-submits
    if (form.dataset.submitting === '1') return;

    // Clear messages
    hideInlineMsg(form, '.form-error');
    hideInlineMsg(form, '.success-message');

    try {
      setSubmitting(form, true);

      // Turnstile token
      let turnstileToken = '';
      const hidden = form.querySelector('input[name="cf-turnstile-response"]');
      if (hidden?.value) turnstileToken = hidden.value;
      if (!turnstileToken && typeof turnstile !== 'undefined' && typeof turnstile.getResponse === 'function') {
        try { turnstileToken = turnstile.getResponse(); } catch {}
      }
      if (!turnstileToken) {
        showError(form, 'Please complete the bot check and try again.');
        setSubmitting(form, false);
        return;
      }

      // Build payload
      const fields  = formToObject(form);
      const formId  = form.id || 'unknown-form';
      const eventId = (crypto?.randomUUID && crypto.randomUUID()) || String(Date.now());

      const res = await postWithRetry(window.API_ENDPOINT || form.action || API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          formId,
          fields,
          turnstileToken,
          sourceUrl: location.href,
          userAgent: navigator.userAgent,
          eventId
        })
      });

      let data = null;
      try { data = await res.json(); } catch {}

      if (!res.ok || !data?.ok) {
        console.error('[Submit] Server error', res.status, data);
        const msg = data?.message || 'Sorry, we couldn\'t submit your form. Please try again.';
        showError(form, msg);
        setSubmitting(form, false);
        return; // IMPORTANT: stop here on failure
      }

      // Success
      form.reset();
      form.classList.add('submitted');

      // Prefer showing the on-brand thank you modal if it exists
      const successModal = document.getElementById('thank-you');
      if (successModal) {
        // Reveal modal, update ARIA, and reset the multi-step UI to step 1
        successModal.classList.remove('hidden');
        successModal.classList.add('show', 'fade-in');
        successModal.setAttribute('aria-hidden', 'false');

        try {
          // If your multi-step flow needs a visual reset, do it gently:
          const steps = document.querySelectorAll('.form-step');
          steps.forEach(s => s.classList.remove('active'));
          const first = document.querySelector('.form-step[data-step="0"]');
          if (first) first.classList.add('active');

          const bar = document.getElementById('progress-bar');
          const lab = document.getElementById('progress-label');
          if (bar) bar.style.width = `${100 / (steps.length || 4)}%`;
          if (lab) lab.textContent = `Step 1 of ${steps.length || 4}`;
        } catch {}

        // Optional: announce success to pixels/analytics without duplicating old logic
        try {
          window.dispatchEvent(new CustomEvent('vlm:iva-submitted', { detail: { ok: true } }));
        } catch {}

        setSubmitting(form, false);
      } else {
        // Fallback (no modal in DOM): show inline success
        showSuccess(form, 'Thanks — we\'ve got your details!');
        setSubmitting(form, false);
      }
    } catch (err) {
      console.error('[Submit] Network error', err);
      showError(form, 'Network error — please try again.');
      setSubmitting(form, false);
    }
  }

  function setSubmitting(form, isSubmitting) {
    const btn = form.querySelector('button[type="submit"], [type="submit"]');
    if (!btn) {
      form.dataset.submitting = isSubmitting ? '1' : '';
      return;
    }
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = (btn.textContent || '').trim();
    }
    const loadingText = btn.getAttribute('data-loading-text') || 'Submitting…';
    btn.disabled = !!isSubmitting;
    btn.setAttribute('aria-busy', String(!!isSubmitting));
    form.dataset.submitting = isSubmitting ? '1' : '';
    btn.textContent = isSubmitting ? loadingText : btn.dataset.originalText;
  }

  // ---------- Inline + Toast UI ----------
  function hideInlineMsg(form, sel) {
    const el = form.querySelector(sel);
    if (el) {
      el.textContent = '';
      el.classList.add('hidden');
      el.style.display = '';
    }
  }
  function showError(form, msg) {
    const el = form.querySelector('.form-error') || ensureInlineBox(form, 'error');
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.display = 'block';
    showToast('error', msg);
  }
  function showSuccess(form, msg) {
    const el = form.querySelector('.success-message') || ensureInlineBox(form, 'success');
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('success', msg);
  }
  function ensureInlineBox(form, kind) {
    const p = document.createElement('p');
    p.className = kind === 'error' ? 'form-error vlm-alert vlm-alert--error' : 'success-message vlm-alert vlm-alert--success';
    p.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    // append near submit button
    const actions = form.querySelector('.form-actions') || form;
    actions.appendChild(p);
    return p;
  }

  // Toast container injected once
  function getToastHost() {
    let host = document.querySelector('.vlm-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'vlm-toast-host';
      document.body.appendChild(host);
    }
    return host;
  }
  function showToast(type, message, timeoutMs = 4000) {
    const host = getToastHost();
    const el = document.createElement('div');
    el.className = `vlm-toast ${type === 'error' ? 'vlm-toast--error' : 'vlm-toast--success'}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <div class="vlm-toast__icon" aria-hidden="true"></div>
      <div class="vlm-toast__text">${escapeHtml(message)}</div>
      <button class="vlm-toast__close" aria-label="Close">×</button>
    `;
    host.appendChild(el);
    const close = () => {
      el.classList.add('vlm-toast--hide');
      setTimeout(() => el.remove(), 200);
    };
    el.querySelector('.vlm-toast__close').addEventListener('click', close);
    setTimeout(close, timeoutMs);
  }
  function escapeHtml(s='') {
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
})();
