import { storage } from '../utils/storage';
import { getBackendOrigin, getFileUrl } from './file.util';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Universal authenticated file downloader for PDFs, ZIP archives, and documents.
 * Directly streams binary responses to disk and supports nested JSON downloadUrl redirects.
 */
export async function downloadFileFromApi(
  urlOrEndpoint: string,
  fallbackFileName: string,
  redirectDepth = 0
): Promise<void> {
  if (redirectDepth > 3) {
    throw new Error('Too many download redirects');
  }

  const token = storage.getToken();

  let targetUrl = (urlOrEndpoint || '').trim();
  if (!targetUrl.startsWith('http')) {
    if (targetUrl.startsWith('/uploads') || targetUrl.startsWith('/archives')) {
      targetUrl = getFileUrl(targetUrl);
    } else if (targetUrl.startsWith('/api')) {
      const origin = getBackendOrigin();
      targetUrl = `${origin}${targetUrl}`;
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
      const rawText = await response.text();
      if (rawText) {
        try {
          const errJson = JSON.parse(rawText);
          if (errJson.message) errMsg = errJson.message;
        } catch {
          if (rawText.length < 200 && !rawText.trim().startsWith('<')) {
            errMsg = `${errMsg}: ${rawText.trim()}`;
          }
        }
      }
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
      return downloadFileFromApi(nestedUrl, fallbackFileName, redirectDepth + 1);
    }
    if (json.message) {
      throw new Error(json.message);
    }
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;

  // Extract filename from Content-Disposition if provided by server
  let fileNameToUse = fallbackFileName;
  const contentDisposition = response.headers.get('content-disposition');
  if (contentDisposition && contentDisposition.includes('filename=')) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match && match[1]) {
      fileNameToUse = match[1].replace(/['"]/g, '').trim();
    }
  }

  a.download = fileNameToUse;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
}
