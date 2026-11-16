const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const env = require('../config/env');

const archiveDir = path.resolve(env.ARCHIVE_DIR);
if (!fs.existsSync(archiveDir)) {
  fs.mkdirSync(archiveDir, { recursive: true });
}

function archiveDossierFiles(dossierNumber, fileEntries = []) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    const safeRef = String(dossierNumber || 'DOSSIER').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipFileName = `dossier_archive_${safeRef}_${Date.now()}.zip`;
    const zipFilePath = path.join(archiveDir, zipFileName);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    let settled = false;
    const fail = (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };

    output.on('close', () => {
      if (!settled) {
        settled = true;
        resolve({
          fileName: zipFileName,
          filePath: zipFilePath,
          fileUrl: `/archives/${zipFileName}`,
        });
      }
    });

    output.on('error', fail);
    archive.on('error', fail);

    archive.pipe(output);

    const usedNames = new Set();
    const seenPaths = new Set();

    (fileEntries || []).forEach((entry) => {
      const sourcePath = typeof entry === 'string' ? entry : entry?.filePath;
      if (!sourcePath || !fs.existsSync(sourcePath)) return;

      const resolvedSource = path.resolve(sourcePath);
      const customName = typeof entry === 'object' && entry?.archiveName ? entry.archiveName : path.basename(resolvedSource);

      // Deduplicate identical file paths when no custom per-applicant archiveName differs
      const dedupKey = `${resolvedSource}::${customName}`;
      if (seenPaths.has(dedupKey)) return;
      seenPaths.add(dedupKey);

      // Prevent archive entry name collisions
      let entryName = String(customName).replace(/[<>:"|?*]/g, '_');
      if (usedNames.has(entryName.toLowerCase())) {
        const ext = path.extname(entryName);
        const base = path.basename(entryName, ext);
        let counter = 2;
        while (usedNames.has(`${base}_${counter}${ext}`.toLowerCase())) {
          counter += 1;
        }
        entryName = `${base}_${counter}${ext}`;
      }
      usedNames.add(entryName.toLowerCase());

      archive.file(resolvedSource, { name: entryName });
    });

    archive.finalize();
  });
}

module.exports = {
  archiveDossierFiles,
};
