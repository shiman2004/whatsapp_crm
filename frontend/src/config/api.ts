/**
 * API Base Configuration
 * Development always uses the local backend. Hostname detection alone is not
 * sufficient because Vite may be opened through IPv6 (`::1`).
 */
// Keep the base URL free of the API path because callers consistently append
// `/api/...`. Render environments have historically used both the bare backend
// origin and an origin ending in `/api`; accepting both prevents `/api/api/*`
// requests that surface as a misleading "Endpoint Not Found" on login.
const envUrl = (import.meta.env.VITE_API_URL as string)
  ?.trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');

export const API_BASE_URL: string = import.meta.env.DEV
  ? (envUrl || 'http://localhost:3000')
  : (envUrl || 'https://royal-wellness-backend.onrender.com');
