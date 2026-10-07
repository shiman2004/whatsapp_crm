/**
 * API Base Configuration
 * Automatically switches between local development (http://localhost:3001)
 * and production Render URL (configured via VITE_API_URL environment variable).
 */
export const API_BASE_URL: string = (import.meta.env.VITE_API_URL as string)?.replace(/\/$/, '') || 'http://localhost:3001';
