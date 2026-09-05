const prisma = require('../config/db');
const { getText } = require('../i18n');

module.exports = function wizardBarrierMiddleware(targetStep) {
  return async (req, res, next) => {
    try {
      const dossierId = req.params.dossierId || req.body.dossierId;
      if (!dossierId) {
        return next();
      }

      const dossier = await prisma.dossier.findUnique({
        where: { id: dossierId },
        include: {
          documents: true,
          visaCategory: {
            include: { requiredDocTypes: true },
          },
        },
      });

      if (!dossier) {
        return res.status(404).json({ success: false, message: 'Dossier not found' });
      }

      if (targetStep >= 6) {
        const requiredDocTypes = dossier.visaCategory.requiredDocTypes.filter((doc) => doc.isRequired);

        const missingMandatoryDocs = requiredDocTypes.filter((reqDoc) => {
          return !dossier.documents.some((d) => d.requiredDocumentType === reqDoc.code);
        });

        if (missingMandatoryDocs.length > 0) {
          return res.status(400).json({
            success: false,
            message: getText('STEP_BLOCKED', req.lang),
            missingDocuments: missingMandatoryDocs.map((m) => m.nameAz),
          });
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
