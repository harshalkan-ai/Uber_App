import { Router } from 'express';
import {
    registerDriverProfile,
    getDriverProfile,
    toggleDriverStatus,
    updateDriverLocation,
    acceptRide,
    updateRideStatus,
} from '../controllers/driver.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Driver registration and profile
router.post('/register', requireAuth, registerDriverProfile);
router.get('/me', requireAuth, getDriverProfile);

// Availability & telemetry
router.patch('/status', requireAuth, toggleDriverStatus);
router.patch('/location', requireAuth, updateDriverLocation);

// Ride workflow actions
router.post('/rides/:id/accept', requireAuth, acceptRide);
router.patch('/rides/:id/status', requireAuth, updateRideStatus);

export default router;