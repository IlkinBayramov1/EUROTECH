const { getText } = require('../i18n');

function requireRoles(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: getText('UNAUTHORIZED', req.lang),
      });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: getText('FORBIDDEN', req.lang),
      });
    }

    next();
  };
}

module.exports = {
  requireRoles,
};
