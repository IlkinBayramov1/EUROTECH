const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const env = require('../config/env');

const archiveDir = path.resolve(env.ARCHIVE_DIR);
if (!fs.existsSync(archiveDir)) {
  fs.mkdirSync(archiveDir, { recursive: true });
}

function archiveDossierFiles(dossierNumber, filePaths = []) {
  return new Promise((resolve, reject) => {
    const zipFileName = `dossier_archive_${dossierNumber}.zip`;
    const zipFilePath = path.join(archiveDir, zipFileName);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      resolve({
        fileName: zipFileName,
        filePath: zipFilePath,
        fileUrl: `/archives/${zipFileName}`,
      });
    });

    archive.on('error', (err) => reject(err));

    archive.pipe(output);

    filePaths.forEach((filePath) => {
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: path.basename(filePath) });
      }
    });

    archive.finalize();
  });
}

module.exports = {
  archiveDossierFiles,
};
