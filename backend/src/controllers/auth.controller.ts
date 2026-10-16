import { Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AuthenticatedRequest, SyncUserDTO, UserRole } from '../types';
import { AppError } from '../middlewares/error.middleware';

// 1. Sync Clerk user to Supabase Database
export const syncUser = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id, email, full_name, phone_number, profile_image_url, role }: SyncUserDTO = req.body;

        if (!id || !email || !full_name) {
            return next(new AppError('id, email, and full_name are required for sync', 400));
        }

        // Upsert (insert or update on conflict) into Supabase
        const { data, error } = await supabase
            .from('users')
            .upsert(
                {
                    id,
                    email,
                    full_name,
                    phone_number: phone_number || null,
                    profile_image_url: profile_image_url || null,
                    role: role || 'rider',
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'id' }
            )
            .select()
            .single();

        if (error) {
            return next(new AppError(`Database error during user sync: ${error.message}`, 500));
        }

        res.status(200).json({
            success: true,
            message: 'User synced successfully',
            data,
        });
    } catch (err) {
        next(err);
    }
};

// 2. Fetch authenticated user profile
export const getMe = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.userId;

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return next(new AppError('User profile not found in database', 404));
        }

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (err) {
        next(err);
    }
};

// 3. Switch between 'rider' and 'driver'
export const updateUserRole = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.userId;
        const { role }: { role: UserRole } = req.body;

        if (!role || !['rider', 'driver'].includes(role)) {
            return next(new AppError("Invalid role. Role must be 'rider' or 'driver'", 400));
        }

        const { data, error } = await supabase
            .from('users')
            .update({ role, updated_at: new Date().toISOString() })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            return next(new AppError(`Failed to update role: ${error.message}`, 500));
        }

        res.status(200).json({
            success: true,
            message: `User role updated to ${role}`,
            data,
        });
    } catch (err) {
        next(err);
    }
};