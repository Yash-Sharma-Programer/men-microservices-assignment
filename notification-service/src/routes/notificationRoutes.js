const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getMyNotifications, getNotificationById } = require('../controllers/notificationController');

const router = express.Router();

router.get('/', requireAuth, getMyNotifications);
router.get('/:id', requireAuth, getNotificationById);

module.exports = router;
