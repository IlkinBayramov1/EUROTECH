const jwt = require('jsonwebtoken');
const env = require('../config/env');
const prisma = require('../config/db');
const { getText } = require('../i18n');

module.exports = async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: getText('UNAUTHORIZED', req.lang),
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        fullName: true,
        companyName: true,
        preferredLanguage: true,
        isVerified: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: getText('UNAUTHORIZED', req.lang),
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: getText('UNAUTHORIZED', req.lang),
    });
  }
};
