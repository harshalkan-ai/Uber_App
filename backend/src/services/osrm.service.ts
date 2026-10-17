import axios from 'axios';
import { AppError } from '../middlewares/error.middleware';

export interface RouteGeometry {
    coordinates: [number, number][]; // Array of [longitude, latitude]
    type: string;
}

export interface RouteDetails {
    distanceKm: number;
    durationMinutes: number;
    geometry: RouteGeometry;
}

/**
 * Calculates road driving distance, trip duration, and route polyline
 * using the open-source OSRM routing engine (Zero billing/card required).
 */
export const calculateRoute = async (
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number
): Promise<RouteDetails> => {
    try {
        // Note: OSRM expects coordinates in {longitude},{latitude} format
        const url = `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?overview=full&geometries=geojson`;

        const response = await axios.get(url, { timeout: 8000 });

        if (!response.data || !response.data.routes || response.data.routes.length === 0) {
            throw new AppError('Unable to calculate driving route between these points', 400);
        }

        const route = response.data.routes[0];

        // OSRM returns distance in meters and duration in seconds
        const distanceKm = Number((route.distance / 1000).toFixed(2));
        const durationMinutes = Math.ceil(route.duration / 60);

        return {
            distanceKm,
            durationMinutes,
            geometry: route.geometry,
        };
    } catch (error: any) {
        if (error instanceof AppError) throw error;
        throw new AppError(`Routing engine failed: ${error.message || 'Service unavailable'}`, 502);
    }
};