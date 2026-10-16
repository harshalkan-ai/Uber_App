import { Router } from 'express';
import { syncUser, getMe, updateUserRole } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/v1/auth/sync - Syncs user profile upon Clerk registration
router.post('/sync', requireAuth, syncUser);

// GET /api/v1/auth/me - Retrieves current user database record
router.get('/me', requireAuth, getMe);

// PATCH /api/v1/auth/role - Switches role between 'rider' and 'driver'
router.patch('/role', requireAuth, updateUserRole);

export default router;