const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const prisma = require('../../../config/db');
const env = require('../../../config/env');
const { generateToken } = require('../../../utils/jwt.util');

async function getSignedUrl(documentId, currentUser) {
  const document = await prisma.applicantDocument.findUnique({
    where: { id: documentId },
    include: { dossier: true },
  });

  if (!document) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }

  const isStaff = ['ADMIN', 'MANAGER', 'OPERATOR'].includes(currentUser.role);
  const isOwner = document.dossier.userId === currentUser.id;

  if (!isStaff && !isOwner) {
    const error = new Error('Security Alert: Access denied. Cross-tenant IDOR violation detected.');
    error.statusCode = 403;
    throw error;
  }

  // Generate 15-minute temporary signed token for download
  const signedToken = generateToken({
    documentId: document.id,
    userId: currentUser.id,
    purpose: 'DOWNLOAD_SIGNED_URL',
  }, '15m');

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const signedUrl = `/api/v1/documents/${document.id}/download?token=${signedToken}`;

  return {
    documentId: document.id,
    fileName: document.fileName,
    signedUrl,
    expiresAt,
  };
}

async function getDocumentFileForDownload(documentId, token, currentUser = null) {
  const document = await prisma.applicantDocument.findUnique({
    where: { id: documentId },
    include: { dossier: true },
  });

  if (!document) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }

  // If signed token is provided, verify token
  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      if (decoded.documentId !== documentId || decoded.purpose !== 'DOWNLOAD_SIGNED_URL') {
        const error = new Error('Invalid download token');
        error.statusCode = 403;
        throw error;
      }
    } catch (jwtErr) {
      const error = new Error('Invalid or expired download token');
      error.statusCode = 403;
      throw error;
    }
  } else if (currentUser) {
    const isStaff = ['ADMIN', 'MANAGER', 'OPERATOR'].includes(currentUser.role);
    const isOwner = document.dossier.userId === currentUser.id;
    if (!isStaff && !isOwner) {
      const error = new Error('Security Alert: Access denied. Cross-tenant IDOR violation detected.');
      error.statusCode = 403;
      throw error;
    }
  } else {
    const error = new Error('Unauthorized download request');
    error.statusCode = 401;
    throw error;
  }

  const uploadDir = path.resolve(env.UPLOAD_DIR);
  const filePath = path.join(uploadDir, path.basename(document.fileUrl));

  if (!fs.existsSync(filePath)) {
    const error = new Error('Physical file not found on server storage');
    error.statusCode = 404;
    throw error;
  }

  return {
    filePath,
    fileName: document.fileName,
  };
}

module.exports = {
  getSignedUrl,
  getDocumentFileForDownload,
};
