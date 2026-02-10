// assets/js/capi.js - Conversions API Integration with Make Webhook
(function() {
  'use strict';
  
  /**
   * Get cookie value by name
   * @param {string} name - Cookie name
   * @returns {string|undefined} Cookie value or undefined
   */
  function getCookie(name) {
    try {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
    } catch (e) {
      if (window.ENV.FBCAPTURE_DEBUG === 'true') {
        console.warn('[CAPI] Cookie read error:', e);
      }
    }
    return undefined;
  }
  
  /**
   * Build fbc parameter from fbclid if present
   * @returns {string|undefined} fbc value or undefined
   */
  function buildFbc() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const fbclid = urlParams.get('fbclid');
      if (fbclid) {
        // Format: fb.1.1234567890123.AbCdEfGhIjKlMnOp
        const timestamp = Math.floor(Date.now() / 1000);
        const randomString = Math.random().toString(36).substring(2, 15);
        return `fb.1.${timestamp}.${randomString}`;
      }
    } catch (e) {
      if (window.ENV.FBCAPTURE_DEBUG === 'true') {
        console.warn('[CAPI] fbc build error:', e);
      }
    }
    return undefined;
  }
  
  /**
   * Build CAPI JSON payload for Make webhook
   * @param {Object} options - Build options
   * @param {string} options.eventId - Event ID for deduplication
   * @param {string} options.sourceUrl - Source URL
   * @param {Object} options.extraUserData - Additional user data (optional)
   * @returns {Object} CAPI JSON payload
   */
  function makeBody({ eventId, sourceUrl, extraUserData = {} }) {
    const userData = {
      fbp: getCookie('_fbp') || undefined,
      fbc: buildFbc(),
      client_user_agent: navigator.userAgent
    };
    
    // Only include extraUserData if provided and not empty
    if (extraUserData && typeof extraUserData === 'object') {
      Object.keys(extraUserData).forEach(key => {
        const value = extraUserData[key];
        if (value !== null && value !== undefined && value !== '') {
          userData[key] = value;
        }
      });
    }
    
    return {
      data: [{
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_id: eventId,
        event_source_url: sourceUrl,
        user_data: userData
      }]
    };
  }
  
  /**
   * Send Lead event to Make webhook for CAPI forwarding
   * @param {string} makeUrl - Make webhook URL
   * @param {Object} options - Send options
   * @param {string} options.eventId - Event ID for deduplication
   * @param {string} options.sourceUrl - Source URL
   * @param {Object} options.extraUserData - Additional user data (optional)
   */
  function sendLeadToMake(makeUrl, { eventId, sourceUrl, extraUserData = {} }) {
    if (!makeUrl || !eventId || !sourceUrl) {
      if (window.ENV.FBCAPTURE_DEBUG === 'true') {
        console.error('[CAPI] Missing required parameters:', { makeUrl, eventId, sourceUrl });
      }
      return;
    }
    
    try {
      const payload = makeBody({ eventId, sourceUrl, extraUserData });
      
      if (window.ENV.FBCAPTURE_DEBUG === 'true') {
        console.log('[CAPI] Sending to Make:', payload);
      }
      
      fetch(makeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }).then(response => {
        if (window.ENV.FBCAPTURE_DEBUG === 'true') {
          console.log('[CAPI] Make response:', response.status, response.statusText);
        }
      }).catch(error => {
        if (window.ENV.FBCAPTURE_DEBUG === 'true') {
          console.warn('[CAPI] Make request error:', error);
        }
      });
      
    } catch (e) {
      if (window.ENV.FBCAPTURE_DEBUG === 'true') {
        console.warn('[CAPI] Send error:', e);
      }
    }
  }
  
  // Export CAPI helper
  window.VLM_CAPI = {
    getCookie,
    buildFbc,
    makeBody,
    sendLeadToMake
  };
  
})();