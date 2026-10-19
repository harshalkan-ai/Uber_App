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

        if (!pickup_lat || !pickup_lng || !dropoff_lat || !dropoff_lng) {
            return next(new AppError('Pickup and dropoff coordinates (lat/lng) are required', 400));
        }

        // 1. Calculate road distance, duration, and road path using OSRM
        const route = await calculateRoute(
            Number(pickup_lat),
            Number(pickup_lng),
            Number(dropoff_lat),
            Number(dropoff_lng)
        );

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

        if (!pickup_address || !pickup_lat || !pickup_lng || !dropoff_address || !dropoff_lat || !dropoff_lng) {
            return next(new AppError('Incomplete pickup or dropoff parameters', 400));
        }

        // Recalculate route on server to prevent client-side tampering with fares
        const route = await calculateRoute(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng);
        const lockedFare = calculateSingleFare(ride_tier, route.distanceKm, route.durationMinutes);

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
        const pickupPoint = `POINT(${pickup_lng} ${pickup_lat})`;
        const dropoffPoint = `POINT(${dropoff_lng} ${dropoff_lat})`;

        // Insert new ride into Supabase
        const { data: ride, error } = await supabase
            .from('rides')
            .insert({
                rider_id: riderId,
                pickup_address,
                pickup_lat,
                pickup_lng,
                pickup_location: pickupPoint,
                dropoff_address,
                dropoff_lat,
                dropoff_lng,
                dropoff_location: dropoffPoint,
                distance_km: route.distanceKm,
                duration_minutes: route.durationMinutes,
                fare_amount: lockedFare,
                ride_tier,
                status: 'requested',
                is_paid: false,
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
 * Retrieves all previous rides for the logged-in user.
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
            .select('*')
            .eq('rider_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            return next(new AppError('Failed to fetch ride history', 500));
        }

        res.status(200).json({
            success: true,
            data: rides,
        });
    } catch (err) {
        next(err);
    }
};