// /assets/js/analytics-init.js
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }

// Consent defaults (no cookies until accepted)
gtag('consent', 'default', {
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  ad_storage: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted'
});

// If you want to track pageview after GA loads:
window.addEventListener('load', () => {
  if (window.gtag) gtag('js', new Date());
});

