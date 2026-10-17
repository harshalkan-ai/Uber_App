import { Server as SocketIOServer, Socket } from 'socket.io';
import { supabase } from '../config/supabase';

interface DriverLocationPayload {
    driverId: string;
    lat: number;
    lng: number;
    heading?: number;
    rideId?: string;
}

interface DispatchRidePayload {
    rideId: string;
    pickupAddress: string;
    dropoffAddress: string;
    fareAmount: number;
    distanceKm: number;
}

export const initSocketHandlers = (io: SocketIOServer): void => {
    io.on('connection', (socket: Socket) => {
        console.log(`[Socket] Client connected: ${socket.id}`);

        // 1. Join Rider to their private notification room
        socket.on('join:rider', (riderId: string) => {
            socket.join(`rider:${riderId}`);
            console.log(`[Socket] Rider ${riderId} joined room rider:${riderId}`);
        });

        // 2. Join Driver to their private dispatch radar room
        socket.on('join:driver', (driverId: string) => {
            socket.join(`driver:${driverId}`);
            console.log(`[Socket] Driver ${driverId} joined room driver:${driverId}`);
        });

        // 3. Join both Rider & Driver to a shared active ride room
        socket.on('join:ride', (rideId: string) => {
            socket.join(`ride:${rideId}`);
            console.log(`[Socket] Client joined active trip room ride:${rideId}`);
        });

        // 4. Live GPS Telemetry Broadcast
        socket.on('driver:location_update', async (data: DriverLocationPayload) => {
            const { driverId, lat, lng, heading, rideId } = data;

            // If driver is on an active trip, stream position to the rider immediately
            if (rideId) {
                socket.to(`ride:${rideId}`).emit('driver:location_changed', {
                    lat,
                    lng,
                    heading: heading || 0,
                });
            }

            // Asynchronously update coordinates in Supabase in background
            try {
                await supabase
                    .from('drivers')
                    .update({
                        current_lat: lat,
                        current_lng: lng,
                        location: `POINT(${lng} ${lat})`,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', driverId);
            } catch (err) {
                console.error('[Socket] Failed to persist driver coordinates:', err);
            }
        });

        // 5. Dispatch ride alert to a target driver
        socket.on('ride:dispatch_to_driver', ({ driverId, ride }: { driverId: string; ride: DispatchRidePayload }) => {
            io.to(`driver:${driverId}`).emit('ride:new_request', ride);
        });

        // 6. Broadcast Ride Status Changes ('arrived', 'in_progress', 'completed')
        socket.on('ride:status_update', ({ rideId, status }: { rideId: string; status: string }) => {
            io.to(`ride:${rideId}`).emit('ride:status_changed', { status });
        });

        // 7. Cleanup on disconnect
        socket.on('disconnect', () => {
            console.log(`[Socket] Client disconnected: ${socket.id}`);
        });
    });
};