import { storage } from '../utils/storage';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Universal authenticated file downloader for PDFs, ZIP archives, and documents.
 * Directly streams binary responses to disk and supports nested JSON downloadUrl redirects.
 */
export async function downloadFileFromApi(urlOrEndpoint: string, fallbackFileName: string): Promise<void> {
  const token = storage.getToken();

  let targetUrl = urlOrEndpoint;
  if (!targetUrl.startsWith('http')) {
    if (targetUrl.startsWith('/api') || targetUrl.startsWith('/uploads') || targetUrl.startsWith('/archives')) {
      targetUrl = targetUrl;
    } else {
      targetUrl = `${API_BASE_URL}${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
    }
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(targetUrl, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    let errMsg = `Download failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.message) errMsg = errJson.message;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await response.json();
    const nestedUrl =
      json.data?.downloadUrl ||
      json.data?.fileUrl ||
      json.downloadUrl ||
      json.fileUrl ||
      json.data?.summaryPdfUrl ||
      json.data?.checklistPdfUrl;

    if (nestedUrl) {
      return downloadFileFromApi(nestedUrl, fallbackFileName);
    }
    if (json.message) {
      throw new Error(json.message);
    }
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fallbackFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
}
