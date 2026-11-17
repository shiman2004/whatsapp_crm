/**
 * API Base Configuration
 * Development uses the local backend at 127.0.0.1:3000 (IPv4, not localhost:
 * Windows resolves localhost to ::1 first, which can hit a different service).
 * Production defaults to https://royal-wellness-backend.onrender.com.
 */
const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname === '[::1]'
);

// Keep the base URL free of trailing slashes and redundant `/api` path
const envUrl = (import.meta.env.VITE_API_URL as string)
  ?.trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');

// Ignore outdated or dead Render services (like whatsapp-crm-60v6 or localhost when deployed in production)
const isOutdatedOrInvalid = !envUrl || 
  envUrl.includes('00v6') || 
  envUrl.includes('60v6') || 
  envUrl.includes('whatsapp-crm') ||
  (!isLocal && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')));

export const API_BASE_URL: string = (import.meta.env.DEV || isLocal)
  ? (envUrl && !envUrl.includes('onrender.com') ? envUrl : 'http://127.0.0.1:3000')
  : (isOutdatedOrInvalid ? 'https://royal-wellness-backend.onrender.com' : envUrl);
