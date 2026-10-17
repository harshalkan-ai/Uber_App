import { Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AuthenticatedRequest, DriverStatus, RideStatus } from '../types';
import { AppError } from '../middlewares/error.middleware';

/**
 * 1. POST /api/v1/drivers/register
 * Onboard vehicle details for a driver.
 */
export const registerDriverProfile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }

        const { vehicle_model, vehicle_plate, vehicle_color, ride_tier = 'UberGo' } = req.body;

        if (!vehicle_model || !vehicle_plate || !vehicle_color) {
            return next(new AppError('Vehicle model, plate, and color are required', 400));
        }

        // 1. Update user role in users table to 'driver'
        await supabase.from('users').update({ role: 'driver' }).eq('id', userId);

        // 2. Create or update driver vehicle profile
        const { data: driver, error } = await supabase
            .from('drivers')
            .upsert(
                {
                    user_id: userId,
                    vehicle_model,
                    vehicle_plate,
                    vehicle_color,
                    ride_tier,
                    status: 'offline',
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' }
            )
            .select()
            .single();

        if (error) {
            return next(new AppError(`Failed to register driver profile: ${error.message}`, 500));
        }

        res.status(201).json({
            success: true,
            message: 'Driver profile registered successfully',
            data: driver,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 2. GET /api/v1/drivers/me
 * Fetch driver profile, vehicle details, and active status.
 */
export const getDriverProfile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }

        const { data: driver, error } = await supabase
            .from('drivers')
            .select('*, user:users!drivers_user_id_fkey(*)')
            .eq('user_id', userId)
            .single();

        if (error || !driver) {
            return next(new AppError('Driver profile not found. Please register your vehicle first.', 404));
        }

        res.status(200).json({
            success: true,
            data: driver,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 3. PATCH /api/v1/drivers/status
 * Toggle driver availability (online / offline).
 */
export const toggleDriverStatus = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }

        const { status }: { status: DriverStatus } = req.body;

        if (!['online', 'offline'].includes(status)) {
            return next(new AppError("Status must be either 'online' or 'offline'", 400));
        }

        const { data: driver, error } = await supabase
            .from('drivers')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            return next(new AppError('Failed to update driver status', 500));
        }

        res.status(200).json({
            success: true,
            message: `Driver is now ${status}`,
            data: driver,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 4. PATCH /api/v1/drivers/location
 * HTTP fallback for driver GPS updates.
 */
export const updateDriverLocation = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }

        const { lat, lng } = req.body;

        if (lat === undefined || lng === undefined) {
            return next(new AppError('Latitude and Longitude are required', 400));
        }

        const locationPoint = `POINT(${lng} ${lat})`;

        const { error } = await supabase
            .from('drivers')
            .update({
                current_lat: lat,
                current_lng: lng,
                location: locationPoint,
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

        if (error) {
            return next(new AppError('Failed to update location', 500));
        }

        res.status(200).json({ success: true, message: 'Location updated' });
    } catch (err) {
        next(err);
    }
};

/**
 * 5. POST /api/v1/drivers/rides/:id/accept
 * Atomic ride acceptance: prevents double-booking race conditions.
 */
export const acceptRide = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }

        const { id: rideId } = req.params;

        // 1. Get driver record
        const { data: driver, error: driverErr } = await supabase
            .from('drivers')
            .select('id, status')
            .eq('user_id', userId)
            .single();

        if (driverErr || !driver) {
            return next(new AppError('Driver profile not found', 404));
        }

        // 2. Atomic Update: only accept if status is STILL 'requested' and driver_id IS NULL
        const { data: updatedRide, error: rideErr } = await supabase
            .from('rides')
            .update({
                driver_id: driver.id,
                status: 'accepted',
                updated_at: new Date().toISOString(),
            })
            .eq('id', rideId)
            .eq('status', 'requested')
            .is('driver_id', null)
            .select()
            .single();

        if (rideErr || !updatedRide) {
            return next(
                new AppError('This ride is no longer available. Another driver may have accepted it.', 409)
            );
        }

        // 3. Mark driver as 'busy'
        await supabase.from('drivers').update({ status: 'busy' }).eq('id', driver.id);

        res.status(200).json({
            success: true,
            message: 'Ride accepted successfully',
            data: updatedRide,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 6. PATCH /api/v1/drivers/rides/:id/status
 * Updates trip progress: 'arrived' -> 'in_progress' -> 'completed'.
 */
export const updateRideStatus = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }

        const { id: rideId } = req.params;
        const { status }: { status: RideStatus } = req.body;

        const allowedTransitions: RideStatus[] = ['arrived', 'in_progress', 'completed'];

        if (!allowedTransitions.includes(status)) {
            return next(new AppError("Invalid status. Must be 'arrived', 'in_progress', or 'completed'", 400));
        }

        // Fetch driver
        const { data: driver } = await supabase
            .from('drivers')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (!driver) {
            return next(new AppError('Driver record not found', 404));
        }

        // Update ride state
        const { data: ride, error } = await supabase
            .from('rides')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', rideId)
            .eq('driver_id', driver.id)
            .select()
            .single();

        if (error || !ride) {
            return next(new AppError('Unable to update ride status', 400));
        }

        // If trip completed, set driver back to 'online' so they can receive new trips
        if (status === 'completed') {
            await supabase
                .from('drivers')
                .update({ status: 'online', updated_at: new Date().toISOString() })
                .eq('id', driver.id);
        }

        res.status(200).json({
            success: true,
            message: `Ride marked as ${status}`,
            data: ride,
        });
    } catch (err) {
        next(err);
    }
};