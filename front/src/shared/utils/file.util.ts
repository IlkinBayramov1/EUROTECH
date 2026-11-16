/**
 * File & Storage URL Resolution Utilities
 * Dynamically resolves file URLs against the active backend origin (from VITE_API_URL or window.location)
 * instead of hardcoding localhost:5000.
 */

export function getBackendOrigin(): string {
  const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1').trim();
  // Strip trailing /api/v1 or /api
  const origin = apiUrl.replace(/\/api(\/v\d+)?\/?$/, '');
  return origin;
}

export function getFileUrl(fileUrl?: string | null): string {
  if (!fileUrl) return '';
  const trimmed = fileUrl.trim();
  if (!trimmed) return '';

  // Already an absolute external or blob URL
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const backendOrigin = getBackendOrigin();
  // Normalize Windows backslashes and ensure leading slash
  const normalized = trimmed.replace(/\\/g, '/');
  const cleanPath = normalized.startsWith('/') ? normalized : `/${normalized}`;

  return `${backendOrigin}${cleanPath}`;
}

