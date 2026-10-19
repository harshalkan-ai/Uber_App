'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@clerk/nextjs';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

import Navbar from '@/components/Navbar';
import RideSearchCard from '@/components/RideSearchCard';
import RideTierSelector, { BookedRide } from '@/components/RideTierSelector';
import SearchingModal from '@/components/SearchingModal';
import ActiveRideCard from '@/components/ActiveRideCard';
import ActivityModal from '@/components/ActivityModal';
import RatingModal from '@/components/RatingModal';
import SosModal from '@/components/SosModal';

// ─── Dynamic imports (no SSR) ──────────────────────────────────────────────
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-neutral-100 animate-pulse flex items-center justify-center">
      <div className="text-neutral-400 text-sm">Loading map…</div>
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'Ride';
type TripPhase =
  | 'idle'         // Search card visible
  | 'choosing'     // Tier selector visible
  | 'searching'    // Radar animation
  | 'active'       // Driver assigned / in progress
  | 'completed';   // Trip done

interface Coords { lat: number; lng: number; }

interface FareEstimate {
  tier: string;
  price: number;
  originalPrice: number;
  durationMinutes: number;
  distanceKm: number;
}

interface RouteData {
  distanceKm: number;
  durationMinutes: number;
  geometry: [number, number][];
}

interface DriverInfo {
  name: string;
  phone?: string;
  vehicle_model: string;
  vehicle_plate: string;
  vehicle_color: string;
  rating: number;
  profile_image_url?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL!;

export default function Home() {
  // ─── Tab state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('Ride');

  // ─── Map state ─────────────────────────────────────────────────────────
  const [pickupCoords, setPickupCoords] = useState<Coords | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<Coords | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null);
  const [driverLocation, setDriverLocation] = useState<{lat:number;lng:number;heading?:number} | null>(null);

  // ─── Fare / booking state ───────────────────────────────────────────────
  const [fareEstimates, setFareEstimates] = useState<FareEstimate[]>([]);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [bookedRide, setBookedRide] = useState<BookedRide | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>('UberGo');
  const [rideStatus, setRideStatus] = useState<string>('requested');
  const [driver, setDriver] = useState<DriverInfo | null>(null);

  // ─── Modal state ───────────────────────────────────────────────────────
  const [showActivity, setShowActivity] = useState(false);
  const [showSos, setShowSos] = useState(false);
  const [showRating, setShowRating] = useState(false);

  // ─── Trip phase ─────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<TripPhase>('idle');

  // ─── Socket ─────────────────────────────────────────────────────────────
  const socketRef = useRef<Socket | null>(null);

  // ─── Clerk auth ─────────────────────────────────────────────────────────
  const { getToken, userId, isSignedIn } = useAuth();

  const getAuthToken = useCallback(async () => {
    try {
      return await getToken();
    } catch {
      return null;
    }
  }, [getToken]);

  // ─── Socket setup & teardown ────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    // Join rider room for notifications
    socket.on('connect', () => {
      console.log('[Rider Socket] Connected:', socket.id);
      if (userId) {
        socket.emit('join:rider', userId);
      }
      if (bookedRide?.id) {
        socket.emit('join:ride', bookedRide.id);
      }
    });

    // Driver location updates
    socket.on('driver:location_changed', (data: { lat: number; lng: number; heading?: number }) => {
      setDriverLocation(data);
    });

    // Ride status changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('ride:status_changed', (payload: any) => {
      console.log('[Rider Socket] ride:status_changed received:', payload);
      const status = payload?.status;
      if (!status) return;

      // Only process if it matches current booked ride (or if no specific rideId is specified)
      if (payload.rideId && bookedRide?.id && payload.rideId !== bookedRide.id) {
        return;
      }

      setRideStatus(status);

      if (payload.driver) {
        const d = payload.driver;
        setDriver({
          name: d.driver_name || d.name || d.user?.full_name || 'Vikram Pawar',
          phone: d.user?.phone_number || d.phone || '+91 98765 43210',
          vehicle_model: d.vehicle_model || 'Tata Nexon',
          vehicle_plate: d.vehicle_plate || 'MH 04 DK 4019',
          vehicle_color: d.vehicle_color || 'Grey',
          rating: d.rating || 5.0,
          profile_image_url: d.user?.profile_image_url || d.profile_image_url,
        });
      }

      if (payload.driverLocation) {
        setDriverLocation(payload.driverLocation);
      }

      if (status === 'assigned' || status === 'accepted' || status === 'arrived' || status === 'in_progress') {
        setPhase('active');
      }
      if (status === 'completed') {
        setPhase('completed');
        setShowRating(true);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, bookedRide?.id]);

  // ─── Poll ride status after booking ───────────────────────────────────
  useEffect(() => {
    if (!bookedRide || phase !== 'searching') return;

    const pollInterval = setInterval(async () => {
      try {
        const token = await getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const { data } = await axios.get<{
          success: boolean;
          data: {
            status: string;
            driver?: {
              vehicle_model: string;
              vehicle_plate: string;
              vehicle_color: string;
              rating: number;
              user?: { full_name: string; phone_number: string; profile_image_url: string };
            };
          };
        }>(
          `${API_URL}/rides/${bookedRide.id}`,
          { headers }
        );

        const rideDetails = data.data;
        setRideStatus(rideDetails.status);

        if ((rideDetails.status === 'assigned' || rideDetails.status === 'accepted') && rideDetails.driver) {
          const d = rideDetails.driver;
          setDriver({
            name: (d as any).driver_name || d.user?.full_name || 'Vikram Pawar',
            phone: d.user?.phone_number || '+91 98765 43210',
            vehicle_model: d.vehicle_model || 'Tata Nexon',
            vehicle_plate: d.vehicle_plate || 'MH 04 DK 4019',
            vehicle_color: d.vehicle_color || 'Grey',
            rating: d.rating || 5.0,
            profile_image_url: d.user?.profile_image_url,
          });
          setPhase('active');

          // Join ride room for GPS updates
          if (socketRef.current) {
            socketRef.current.emit('join:ride', bookedRide.id);
          }

          clearInterval(pollInterval);
        }
      } catch {
        // Silently ignore poll errors
      }
    }, 2500); // Poll every 2.5 seconds

    return () => clearInterval(pollInterval);
  }, [bookedRide, phase, getAuthToken]);

  // ─── Tab change handler ─────────────────────────────────────────────────
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  };

  // ─── Estimate result handler ────────────────────────────────────────────
  const handleEstimateResult = useCallback(
    (result: { route: RouteData; estimates: FareEstimate[] } | null) => {
      if (result) {
        setRouteData(result.route);
        setRouteGeometry(result.route.geometry);
        setFareEstimates(result.estimates);
        setSelectedTier(result.estimates[0]?.tier || 'UberGo');
        setPhase('choosing');
      } else {
        setRouteData(null);
        setRouteGeometry(null);
        setFareEstimates([]);
        setPhase('idle');
      }
    },
    []
  );

  // ─── Ride booked handler ────────────────────────────────────────────────
  const handleRideBooked = useCallback((ride: BookedRide) => {
    setBookedRide(ride);
    setSelectedTier(ride.ride_tier);
    setPhase('searching');
  }, []);

  // ─── Cancel ride ────────────────────────────────────────────────────────
  const handleCancelRide = useCallback(async () => {
    if (bookedRide) {
      try {
        const token = await getAuthToken();
        if (token) {
          await axios.patch(
            `${API_URL}/rides/${bookedRide.id}/cancel`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      } catch {
        // Ignore cancel errors
      }
    }
    // Reset state
    setBookedRide(null);
    setDriver(null);
    setDriverLocation(null);
    setRideStatus('requested');
    setPhase('choosing');
  }, [bookedRide, getAuthToken]);

  // ─── Cancel searching ──────────────────────────────────────────────────
  const handleCancelSearch = useCallback(async () => {
    if (bookedRide) {
      try {
        const token = await getAuthToken();
        if (token) {
          await axios.patch(
            `${API_URL}/rides/${bookedRide.id}/cancel`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      } catch {
        // Ignore
      }
    }
    setBookedRide(null);
    setPhase('choosing');
  }, [bookedRide, getAuthToken]);

  // ─── Reset after completed ─────────────────────────────────────────────
  const handleNewRide = () => {
    setPickupCoords(null);
    setDropoffCoords(null);
    setPickupAddress('');
    setDropoffAddress('');
    setRouteGeometry(null);
    setRouteData(null);
    setFareEstimates([]);
    setBookedRide(null);
    setDriver(null);
    setDriverLocation(null);
    setRideStatus('requested');
    setPhase('idle');
  };

  // ─── Render left panel content ─────────────────────────────────────────
  const renderLeftPanel = (isMobile = false) => {
    // Completed
    if (phase === 'completed') {
      return (
        <div
          className={`bg-white rounded-2xl text-center animate-fadeInUp ${
            isMobile ? 'p-2 border-0 shadow-none' : 'p-6 w-full max-w-[400px] shadow-2xl border border-neutral-200'
          }`}
        >
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-black mb-2">Ride Completed!</h2>
          <p className="text-sm text-neutral-500 mb-1">
            {pickupAddress.split(',')[0]} → {dropoffAddress.split(',')[0]}
          </p>
          <p className="text-2xl font-black text-black mb-6">
            ₹{bookedRide?.fare_amount?.toFixed(2)}
          </p>
          <button
            id="btn-rate-trip"
            onClick={() => setShowRating(true)}
            className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-black rounded-xl font-bold text-sm transition-all mb-2 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            ⭐ Rate Driver & Trip
          </button>
          <button
            id="btn-new-ride"
            onClick={handleNewRide}
            className="w-full py-3.5 bg-black text-white rounded-xl font-semibold text-sm hover:bg-neutral-800 transition-all shadow-md cursor-pointer"
          >
            Book another ride
          </button>
        </div>
      );
    }

    // Active ride (driver assigned / in progress)
    if (phase === 'active' && driver && bookedRide) {
      return (
        <ActiveRideCard
          driver={driver}
          status={rideStatus}
          pickupAddress={pickupAddress}
          dropoffAddress={dropoffAddress}
          fareAmount={bookedRide.fare_amount}
          tier={bookedRide.ride_tier}
          otp={bookedRide.otp || '4821'}
          onCancel={handleCancelRide}
          onSos={() => setShowSos(true)}
        />
      );
    }

    // Tier selection
    if (phase === 'choosing' && fareEstimates.length > 0 && routeData) {
      return (
        <RideTierSelector
          estimates={fareEstimates}
          rideData={{
            pickupAddress,
            dropoffAddress,
            pickupLat: pickupCoords!.lat,
            pickupLng: pickupCoords!.lng,
            dropoffLat: dropoffCoords!.lat,
            dropoffLng: dropoffCoords!.lng,
          }}
          getAuthToken={getAuthToken}
          onRideBooked={handleRideBooked}
          onBack={() => setPhase('idle')}
          isMobile={isMobile}
        />
      );
    }

    // Default: Search card
    return (
      <RideSearchCard
        onPickupChange={(coords, address) => {
          setPickupCoords(coords);
          setPickupAddress(address);
        }}
        onDropoffChange={(coords, address) => {
          setDropoffCoords(coords);
          setDropoffAddress(address);
        }}
        onEstimateResult={handleEstimateResult}
        getAuthToken={getAuthToken}
        isMobile={isMobile}
      />
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenActivity={() => setShowActivity(true)}
      />

      {/* ─── 32% / 68% Desktop Split Screen Layout ─────────────────────── */}
      <div className="flex flex-col md:flex-row w-full h-[calc(100vh-64px)] overflow-hidden bg-white relative">
        {/* Left 32% Sidebar Panel */}
        <aside className="w-full md:w-[35%] lg:w-[32%] min-w-[360px] md:min-w-[400px] max-w-[500px] h-[50vh] md:h-full bg-white text-black border-t md:border-t-0 md:border-r border-neutral-200 p-5 md:p-6 flex flex-col justify-between overflow-y-auto shadow-2xl md:shadow-lg z-20 flex-shrink-0 order-2 md:order-1">
          {renderLeftPanel(true)}
        </aside>

        {/* Right 68% Map Canvas */}
        <main className="flex-1 h-[50vh] md:h-full relative z-10 w-full order-1 md:order-2">
          <Map
            pickupCoords={pickupCoords}
            dropoffCoords={dropoffCoords}
            routeGeometry={routeGeometry}
            driverLocation={driverLocation}
            pickupAddress={pickupAddress}
            dropoffAddress={dropoffAddress}
            driverName={driver?.name || 'Assigned Driver'}
            vehiclePlate={driver?.vehicle_plate || 'MH 04 DK 4019'}
          />
        </main>
      </div>

      {/* ─── Modals ─────────────────────────────────────────────────────── */}

      {/* Searching for driver modal */}
      {phase === 'searching' && bookedRide && (
        <SearchingModal
          onCancel={handleCancelSearch}
          pickupAddress={pickupAddress}
          dropoffAddress={dropoffAddress}
          tier={bookedRide.ride_tier}
        />
      )}

      {/* Activity / Ride History & Receipts Modal */}
      <ActivityModal
        isOpen={showActivity}
        onClose={() => setShowActivity(false)}
      />

      {/* Rating & Reviews Modal */}
      <RatingModal
        isOpen={showRating}
        driverName={driver?.name || 'Driver Partner'}
        vehicleModel={`${driver?.vehicle_color || ''} ${driver?.vehicle_model || ''}`}
        fareAmount={bookedRide?.fare_amount || 145.0}
        onSubmit={async (rating, feedback) => {
          if (bookedRide?.id) {
            try {
              const token = await getAuthToken();
              if (token) {
                await axios.post(
                  `${API_URL}/rides/${bookedRide.id}/review`,
                  { rating, feedback },
                  { headers: { Authorization: `Bearer ${token}` } }
                );
              }
            } catch (err) {
              console.error('Failed to submit review:', err);
            }
          }
          setShowRating(false);
        }}
        onClose={() => setShowRating(false)}
      />

      {/* Emergency SOS Safety Modal */}
      <SosModal
        isOpen={showSos}
        onClose={() => setShowSos(false)}
        currentAddress={dropoffAddress || pickupAddress || 'Mumbai, Maharashtra'}
        driverName={driver?.name || 'Driver Partner'}
        vehiclePlate={driver?.vehicle_plate || 'MH 04 DK 4019'}
      />

    </div>
  );
}
