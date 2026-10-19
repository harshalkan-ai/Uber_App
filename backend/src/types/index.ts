import { Request } from 'express';

// 1. System Enums (Matching Supabase Postgres ENUMs)
export type UserRole = 'rider' | 'driver' | 'admin';
export type DriverStatus = 'offline' | 'online' | 'busy';
export type RideStatus = 'requested' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
export type RideTier = 'UberGo' | 'UberPremier' | 'UberXL';

// 2. Database Entities
export interface User {
    id: string; // Clerk User ID
    email: string;
    full_name: string;
    phone_number?: string;
    role: UserRole;
    profile_image_url?: string;
    created_at: string;
    updated_at: string;
}

export interface Driver {
    id: string; // UUID
    user_id: string;
    driver_name?: string;
    vehicle_model: string;
    vehicle_plate: string;
    vehicle_color: string;
    ride_tier: RideTier;
    status: DriverStatus;
    current_lat?: number;
    current_lng?: number;
    rating: number;
    total_trips: number;
    created_at: string;
    updated_at: string;
}

export interface Ride {
    id: string; // UUID
    rider_id: string;
    driver_id?: string;
    pickup_address: string;
    pickup_lat: number;
    pickup_lng: number;
    dropoff_address: string;
    dropoff_lat: number;
    dropoff_lng: number;
    distance_km: number;
    duration_minutes: number;
    fare_amount: number;
    ride_tier: RideTier;
    status: RideStatus;
    otp?: string;
    stripe_payment_intent_id?: string;
    is_paid: boolean;
    created_at: string;
    updated_at: string;
}

// 3. API Request Payloads (DTOs)
export interface SyncUserDTO {
    id: string;
    email: string;
    full_name: string;
    phone_number?: string;
    profile_image_url?: string;
    role?: UserRole;
}

export interface CreateRideDTO {
    pickup_address: string;
    pickup_lat: number;
    pickup_lng: number;
    dropoff_address: string;
    dropoff_lat: number;
    dropoff_lng: number;
    ride_tier: RideTier;
}

export interface UpdateLocationDTO {
    lat: number;
    lng: number;
    heading?: number;
}

// 4. Express Request with Clerk Auth Context
export interface AuthenticatedRequest extends Request {
    userId?: string;
    userRole?: UserRole;
}