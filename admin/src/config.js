// Keep local development on the Vite proxy so API requests are same-origin.
// Production can override this with VITE_API_BASE at build time.
const configuredApiBase = import.meta.env.VITE_API_BASE;
export const API_BASE = (configuredApiBase !== undefined
  ? configuredApiBase
  : import.meta.env.DEV
    ? ''
    : 'https://zc-api.carelife.top').replace(/\/+$/, '');
