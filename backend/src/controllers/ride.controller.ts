import { Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AuthenticatedRequest, CreateRideDTO } from '../types';
import { calculateRoute } from '../services/osrm.service';
import { calculateAllFares, calculateSingleFare } from '../services/fare.service';
import { AppError } from '../middlewares/error.middleware';
import { io } from '../server';

/**
 * 1. POST /api/v1/rides/estimate
 * Calculates route polyline and gives fare options for all vehicle tiers.
 */
export const estimateRideFare = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } = req.body;

        if (pickup_lat === undefined || pickup_lng === undefined || dropoff_lat === undefined || dropoff_lng === undefined) {
            return next(new AppError('Pickup and dropoff coordinates (lat/lng) are required', 400));
        }

        const pLat = parseFloat(pickup_lat);
        const pLng = parseFloat(pickup_lng);
        const dLat = parseFloat(dropoff_lat);
        const dLng = parseFloat(dropoff_lng);

        if (isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng)) {
            return next(new AppError('Coordinates must be valid numbers', 400));
        }

        // 1. Calculate road distance, duration, and road path using OSRM
        const route = await calculateRoute(pLat, pLng, dLat, dLng);

        // 2. Generate dynamic fare pricing matrix for all tiers
        const fareEstimates = calculateAllFares(route.distanceKm, route.durationMinutes);

        res.status(200).json({
            success: true,
            data: {
                route: {
                    distanceKm: route.distanceKm,
                    durationMinutes: route.durationMinutes,
                    geometry: route.geometry,
                },
                estimates: fareEstimates,
            },
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 2. POST /api/v1/rides/book
 * Creates a new ride booking and sets status to 'requested'.
 */
export const bookRide = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const riderId = req.userId;
        const {
            pickup_address,
            pickup_lat,
            pickup_lng,
            dropoff_address,
            dropoff_lat,
            dropoff_lng,
            ride_tier = 'UberGo',
        }: CreateRideDTO = req.body;

        if (!pickup_address || pickup_lat === undefined || pickup_lng === undefined || !dropoff_address || dropoff_lat === undefined || dropoff_lng === undefined) {
            return next(new AppError('Incomplete pickup or dropoff parameters', 400));
        }

        const pLat = parseFloat(pickup_lat as any);
        const pLng = parseFloat(pickup_lng as any);
        const dLat = parseFloat(dropoff_lat as any);
        const dLng = parseFloat(dropoff_lng as any);

        // Recalculate route on server to prevent client-side tampering with fares
        const route = await calculateRoute(pLat, pLng, dLat, dLng);
        const lockedFare = calculateSingleFare(ride_tier, route.distanceKm, route.durationMinutes);

        // Generate a random 4-digit Safety OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString(); // e.g. "4821"

        // Ensure user exists in users table to prevent foreign key constraint violations
        await supabase.from('users').upsert(
            {
                id: riderId,
                email: `${riderId}@uber.dev`,
                full_name: 'Uber Rider',
                role: 'rider',
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
        );

        // Format PostGIS Well-Known Text (WKT) points
        const pickupPoint = `POINT(${pLng} ${pLat})`;
        const dropoffPoint = `POINT(${dLng} ${dLat})`;

        // Insert new ride into Supabase
        const { data: ride, error } = await supabase
            .from('rides')
            .insert({
                rider_id: riderId,
                pickup_address,
                pickup_lat: pLat,
                pickup_lng: pLng,
                pickup_location: pickupPoint,
                dropoff_address,
                dropoff_lat: dLat,
                dropoff_lng: dLng,
                dropoff_location: dropoffPoint,
                distance_km: route.distanceKm,
                duration_minutes: route.durationMinutes,
                fare_amount: lockedFare,
                ride_tier,
                status: 'requested',
                is_paid: false,
                otp, // Save OTP to ride record
            })
            .select()
            .single();

        if (error) {
            return next(new AppError(`Failed to create ride booking: ${error.message}`, 500));
        }

        // Broadcast to all active driver dashboards
        io.emit('ride:new_request', {
            rideId: ride.id,
            pickupAddress: ride.pickup_address,
            dropoffAddress: ride.dropoff_address,
            fareAmount: ride.fare_amount,
            distanceKm: ride.distance_km,
            durationMinutes: ride.duration_minutes,
            rideTier: ride.ride_tier,
            pickupLat: ride.pickup_lat,
            pickupLng: ride.pickup_lng,
            dropoffLat: ride.dropoff_lat,
            dropoffLng: ride.dropoff_lng,
            otp: ride.otp,
        });

        res.status(201).json({
            success: true,
            message: 'Ride requested successfully. Searching for nearby drivers...',
            data: ride,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 3. GET /api/v1/rides/:id
 * Fetches ride details including assigned driver and vehicle.
 */
export const getRideDetails = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const { data: ride, error } = await supabase
            .from('rides')
            .select(`
        *,
        rider:users!rides_rider_id_fkey(id, full_name, phone_number, profile_image_url),
        driver:drivers!rides_driver_id_fkey(
          id,
          vehicle_model,
          vehicle_plate,
          vehicle_color,
          rating,
          user:users!drivers_user_id_fkey(full_name, phone_number, profile_image_url)
        )
      `)
            .eq('id', id)
            .single();

        if (error || !ride) {
            return next(new AppError('Ride not found', 404));
        }

        res.status(200).json({
            success: true,
            data: ride,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 4. PATCH /api/v1/rides/:id/cancel
 * Allows cancellation only if the trip has not yet started.
 */
export const cancelRide = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        // Fetch existing ride
        const { data: ride, error: fetchError } = await supabase
            .from('rides')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !ride) {
            return next(new AppError('Ride not found', 404));
        }

        if (ride.rider_id !== userId) {
            return next(new AppError('Unauthorized: You can only cancel your own rides', 403));
        }

        if (['in_progress', 'completed'].includes(ride.status)) {
            return next(new AppError(`Cannot cancel a trip that is already ${ride.status}`, 400));
        }

        // Transition state to cancelled
        const { data: updatedRide, error: updateError } = await supabase
            .from('rides')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            return next(new AppError('Failed to cancel ride', 500));
        }

        res.status(200).json({
            success: true,
            message: 'Ride cancelled successfully',
            data: updatedRide,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 5. GET /api/v1/rides/history
 * Retrieves all previous rides for the logged-in user with driver and review information.
 */
export const getUserRideHistory = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.userId;

        const { data: rides, error } = await supabase
            .from('rides')
            .select(`
                *,
                driver:drivers!rides_driver_id_fkey(
                    id,
                    vehicle_model,
                    vehicle_plate,
                    vehicle_color,
                    rating,
                    user:users!drivers_user_id_fkey(full_name, phone_number, profile_image_url)
                ),
                reviews(id, rating, feedback)
            `)
            .eq('rider_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            // Fallback to basic select if join fails
            const { data: basicRides, error: basicErr } = await supabase
                .from('rides')
                .select('*')
                .eq('rider_id', userId)
                .order('created_at', { ascending: false });

            if (basicErr) {
                return next(new AppError('Failed to fetch ride history', 500));
            }

            res.status(200).json({
                success: true,
                data: basicRides,
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: rides,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 6. POST /api/v1/rides/:id/review
 * Submits rider review & rating, updates reviews table, and recalculates driver rating.
 */
export const submitReview = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const riderId = req.userId;
        const { rating, feedback } = req.body;

        const numericRating = Number(rating);
        if (!numericRating || numericRating < 1 || numericRating > 5) {
            return next(new AppError('Rating must be a number between 1 and 5', 400));
        }

        // Verify ride exists
        const { data: ride, error: rideError } = await supabase
            .from('rides')
            .select('*')
            .eq('id', id)
            .single();

        if (rideError || !ride) {
            return next(new AppError('Ride not found', 404));
        }

        if (ride.rider_id !== riderId) {
            return next(new AppError('Unauthorized: You can only review your own rides', 403));
        }

        if (!ride.driver_id) {
            return next(new AppError('Cannot review a ride without an assigned driver', 400));
        }

        // Insert review into reviews table
        const { data: review, error: reviewError } = await supabase
            .from('reviews')
            .insert({
                ride_id: id,
                rider_id: riderId,
                driver_id: ride.driver_id,
                rating: numericRating,
                feedback: feedback || '',
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (reviewError) {
            return next(new AppError(`Failed to save review: ${reviewError.message}`, 500));
        }

        // Recalculate the driver's average rating in drivers table
        const { data: driverReviews } = await supabase
            .from('reviews')
            .select('rating')
            .eq('driver_id', ride.driver_id);

        if (driverReviews && driverReviews.length > 0) {
            const avgRating = Number(
                (driverReviews.reduce((sum, r) => sum + Number(r.rating || 5), 0) / driverReviews.length).toFixed(1)
            );

            await supabase
                .from('drivers')
                .update({ rating: avgRating, updated_at: new Date().toISOString() })
                .eq('id', ride.driver_id);
        }

        res.status(200).json({
            success: true,
            message: 'Thank you for your rating & feedback!',
            data: review,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 7. GET /api/v1/rides/pending
 * Returns active unassigned rides (status = 'requested' and driver_id IS NULL)
 */
export const getPendingRides = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { data: rides, error } = await supabase
            .from('rides')
            .select(`
                *,
                rider:users!rides_rider_id_fkey(id, full_name, phone_number, profile_image_url)
            `)
            .eq('status', 'requested')
            .is('driver_id', null)
            .order('created_at', { ascending: false });

        if (error) {
            const { data: simpleRides, error: simpleErr } = await supabase
                .from('rides')
                .select('*')
                .eq('status', 'requested')
                .is('driver_id', null)
                .order('created_at', { ascending: false });

            if (simpleErr) {
                return next(new AppError('Failed to fetch pending rides', 500));
            }

            res.status(200).json({
                success: true,
                data: simpleRides || [],
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: rides || [],
        });
    } catch (err) {
        next(err);
    }
};