const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getMe, getUserById, updateMe, listUsers } = require('../controllers/userController');

const router = express.Router();

router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, updateMe);
router.get('/:id', requireAuth, getUserById);
router.get('/', requireAuth, requireRole('admin'), listUsers);

module.exports = router;
