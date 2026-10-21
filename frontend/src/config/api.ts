/**
 * API Base Configuration
 * Development always uses the local backend. Hostname detection alone is not
 * sufficient because Vite may be opened through IPv6 (`::1`).
 */
const envUrl = (import.meta.env.VITE_API_URL as string)?.replace(/\/$/, '');

export const API_BASE_URL: string = import.meta.env.DEV
  ? (envUrl || 'http://localhost:3000')
  : (envUrl || 'https://royal-wellness-backend.onrender.com');
