const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/auth.middleware');
const notificationController = require('./notification.controller');

router.use(authMiddleware);

router.get('/', notificationController.getMyNotifications);
router.patch('/read-all', notificationController.markAllNotificationsAsRead);
router.patch('/:id/read', notificationController.markNotificationAsRead);

module.exports = router;

