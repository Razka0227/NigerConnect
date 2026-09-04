const _loc = typeof window !== 'undefined' ? window.location : null;

const LAN_SERVER = 'http://192.168.120.122:4200';

const apiUrl = (() => {
  try {
    if (!_loc) return '';
    const host = _loc.hostname;
    const port = _loc.port || '';
    // Capacitor WebView: hostname is 'localhost' with no port → native build
    if (host === 'localhost' && !port) return LAN_SERVER;
    // Browser dev on localhost with different port
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if (isLocal && port && port !== '4000') return 'http://localhost:4000';
  } catch (e) {
    // fall back to same-origin
  }
  return '';
})();

export const APP_CONFIG = {
  // '' = same-origin (Angular dev proxy or same server in prod). When the
  // app is served statically on localhost (different port), we point to the
  // backend at http://localhost:4000 so API calls work without a proxy.
  apiUrl,
  appName: 'Niger Connect',
  defaultCountryCode: '+227',
  // Low-data mode: if true, the app requests minimal payloads and
  // disables image loading. Toggled automatically on 2G/3G detection.
  lowData: false,
  version: '0.1.0',
};
