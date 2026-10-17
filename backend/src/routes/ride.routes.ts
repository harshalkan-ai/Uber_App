import { Router } from 'express';
import {
    estimateRideFare,
    bookRide,
    getRideDetails,
    cancelRide,
    getUserRideHistory,
} from '../controllers/ride.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Calculate fare and preview polyline route
router.post('/estimate', requireAuth, estimateRideFare);

// Book and confirm a ride
router.post('/book', requireAuth, bookRide);

// Fetch ride history for current user
router.get('/history', requireAuth, getUserRideHistory);

// Get specific ride details
router.get('/:id', requireAuth, getRideDetails);

// Cancel an active or requested ride
router.patch('/:id/cancel', requireAuth, cancelRide);

export default router;