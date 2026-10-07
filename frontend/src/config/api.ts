/**
 * API Base Configuration
 * Automatically switches between local development (http://localhost:3001)
 * and production Render URL (https://whatsapp-crm-60v6.onrender.com).
 */
const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.')
);

const envUrl = (import.meta.env.VITE_API_URL as string)?.replace(/\/$/, '');

// If envUrl is pointing to localhost or the typo '00v6', automatically fix to live royal-wellness-backend
export const API_BASE_URL: string = (envUrl && !envUrl.includes('00v6') && !envUrl.includes('whatsapp-crm-60v6')) 
  ? envUrl 
  : (isLocal ? 'http://localhost:3001' : 'https://royal-wellness-backend.onrender.com');
