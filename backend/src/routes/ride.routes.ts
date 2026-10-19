import { Router } from 'express';
import {
    estimateRideFare,
    bookRide,
    getPendingRides,
    getRideDetails,
    cancelRide,
    getUserRideHistory,
    submitReview,
} from '../controllers/ride.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// 1. Calculate fare and preview polyline route (PUBLIC - no auth required)
router.post('/estimate', estimateRideFare);

// 2. Book and confirm a ride
router.post('/book', requireAuth, bookRide);

// 3. Fetch active unassigned rides for drivers (MUST BE BEFORE /:id)
router.get('/pending', requireAuth, getPendingRides);

// 4. Fetch ride history for current user
router.get('/history', requireAuth, getUserRideHistory);

// 5. Submit rider review & star rating for a completed ride
router.post('/:id/review', requireAuth, submitReview);

// 6. Get specific ride details
router.get('/:id', requireAuth, getRideDetails);

// 7. Cancel an active or requested ride
router.patch('/:id/cancel', requireAuth, cancelRide);

export default router;