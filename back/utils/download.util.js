const fs = require('fs');
const ApiResponse = require('../core/api.response');

/**
 * Safely streams a binary buffer or physical file download response,
 * sanitizing Content-Disposition headers and catching asynchronous stream errors.
 */
function sendDownloadSafely(res, { filePath, fileName, buffer, contentType = 'application/pdf', inline = false }) {
  const safeFileName = String(fileName || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const dispositionType = inline ? 'inline' : 'attachment';

  if (buffer && buffer.length > 0) {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeFileName}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(Buffer.from(buffer));
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return ApiResponse.error(res, 'Generated file not found on server storage', 404);
  }

  if (inline) {
    const fileBuf = fs.readFileSync(filePath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    res.setHeader('Content-Length', fileBuf.length);
    return res.send(fileBuf);
  }

  return res.download(filePath, safeFileName, (err) => {
    if (err && !res.headersSent) {
      return ApiResponse.error(res, err.message || 'Failed to stream file download', err.statusCode || 400);
    }
  });
}

module.exports = {
  sendDownloadSafely,
};
