'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth, UserButton } from '@clerk/nextjs';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import {
  Navigation,
  Phone,
  Power,
  ChevronRight,
  TrendingUp,
  MapPin,
  Car,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Volume2,
} from 'lucide-react';

// Dynamic import of Leaflet map (client-only)
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
      <div className="text-neutral-400 text-sm font-medium">Loading driver map…</div>
    </div>
  ),
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

// Default Mumbai coordinates
const DEFAULT_COORDS = { lat: 19.076, lng: 72.8777 };

interface IncomingRide {
  rideId: string;
  pickupAddress: string;
  dropoffAddress: string;
  fareAmount: number;
  distanceKm: number;
  durationMinutes?: number;
  rideTier?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  riderName?: string;
  riderPhone?: string;
}

type TripStage = 'heading_to_pickup' | 'arrived' | 'in_progress' | 'completed';

export default function DriverDashboard() {
  const { getToken, userId } = useAuth();

  // Driver Availability
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [todayEarnings, setTodayEarnings] = useState<number>(1450);
  const [completedTripsCount, setCompletedTripsCount] = useState<number>(6);

  // Vehicle info
  const vehicleInfo = {
    model: 'Maruti Suzuki Swift',
    plate: 'MH 02 AB 1234',
    color: 'White',
    rating: 4.92,
    name: 'Rajesh Sharma',
  };

  // Driver GPS Location
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number; heading: number }>({
    lat: DEFAULT_COORDS.lat,
    lng: DEFAULT_COORDS.lng,
    heading: 45,
  });

  // Socket
  const socketRef = useRef<Socket | null>(null);

  // Incoming Dispatch Request
  const [incomingRide, setIncomingRide] = useState<IncomingRide | null>(null);
  const [countdown, setCountdown] = useState<number>(15);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active Trip State
  const [activeTrip, setActiveTrip] = useState<IncomingRide | null>(null);
  const [tripStage, setTripStage] = useState<TripStage>('heading_to_pickup');
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null);

  // ─── Socket Connection ─────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Driver Socket] Connected:', socket.id);
      // Join driver room
      socket.emit('join:driver', userId || 'driver-demo-001');
    });

    // Listen for incoming ride dispatch
    socket.on('ride:new_request', (rideData: IncomingRide) => {
      console.log('[Driver Socket] ride:new_request received:', rideData);
      // Only prompt if online and not currently on an active trip
      if (isOnline && !activeTrip) {
        setIncomingRide(rideData);
        setCountdown(15);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isOnline, activeTrip, userId]);

  // ─── Countdown Timer for Incoming Ride ────────────────────────────────────
  useEffect(() => {
    if (!incomingRide) return;

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current!);
          setIncomingRide(null); // Auto-decline if expired
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [incomingRide]);

  // ─── Live GPS Telemetry Simulation ────────────────────────────────────────
  useEffect(() => {
    if (!isOnline) return;

    // Periodically update driver location slightly to simulate realistic GPS movement
    const telemetryInterval = setInterval(() => {
      setDriverPos((prev) => {
        // Small jitter in Mumbai area
        const deltaLat = (Math.random() - 0.48) * 0.0003;
        const deltaLng = (Math.random() - 0.48) * 0.0003;
        const newLat = prev.lat + deltaLat;
        const newLng = prev.lng + deltaLng;
        const newHeading = (prev.heading + Math.floor(Math.random() * 20 - 10) + 360) % 360;

        const updated = { lat: newLat, lng: newLng, heading: newHeading };

        // Stream position via socket to riders
        if (socketRef.current) {
          socketRef.current.emit('driver:location_update', {
            driverId: userId || 'driver-demo-001',
            lat: newLat,
            lng: newLng,
            heading: newHeading,
            rideId: activeTrip?.rideId,
          });
        }

        return updated;
      });
    }, 3000);

    return () => clearInterval(telemetryInterval);
  }, [isOnline, activeTrip?.rideId, userId]);

  // ─── Fetch OSRM Route for Active Trip ─────────────────────────────────────
  const fetchRouteForTrip = useCallback(async (start: { lat: number; lng: number }, end: { lat: number; lng: number }) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
      const res = await axios.get(url);
      if (res.data?.routes?.[0]?.geometry?.coordinates) {
        setRouteGeometry(res.data.routes[0].geometry.coordinates);
      }
    } catch {
      // Fallback simple 2-point line
      setRouteGeometry([
        [start.lng, start.lat],
        [end.lng, end.lat],
      ]);
    }
  }, []);

  // ─── Accept Trip ──────────────────────────────────────────────────────────
  const handleAcceptRide = async () => {
    if (!incomingRide) return;

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    const rideToAccept = { ...incomingRide };
    setIncomingRide(null);
    setActiveTrip(rideToAccept);
    setTripStage('heading_to_pickup');

    // Notify backend & rider via socket
    if (socketRef.current) {
      socketRef.current.emit('join:ride', rideToAccept.rideId);
      socketRef.current.emit('ride:accept', {
        rideId: rideToAccept.rideId,
        driver: {
          name: vehicleInfo.name,
          vehicle_model: vehicleInfo.model,
          vehicle_plate: vehicleInfo.plate,
          vehicle_color: vehicleInfo.color,
          rating: vehicleInfo.rating,
          phone: '+91 98200 12345',
        },
        driverLocation: driverPos,
      });
    }

    // Attempt backend API call if authenticated
    try {
      const token = await getToken();
      if (token) {
        await axios.post(
          `${API_URL}/drivers/rides/${rideToAccept.rideId}/accept`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch {
      // Socket acceptance is already broadcasted to sync UI
    }

    // Calculate route to pickup
    if (rideToAccept.pickupLat && rideToAccept.pickupLng) {
      fetchRouteForTrip(driverPos, { lat: rideToAccept.pickupLat, lng: rideToAccept.pickupLng });
    }
  };

  // ─── Decline Trip ─────────────────────────────────────────────────────────
  const handleDeclineRide = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setIncomingRide(null);
  };

  // ─── Trip Stage Transitions ───────────────────────────────────────────────
  const handleAdvanceTripStage = async () => {
    if (!activeTrip) return;

    if (tripStage === 'heading_to_pickup') {
      // Arrived at pickup
      setTripStage('arrived');
      if (socketRef.current) {
        socketRef.current.emit('ride:status_update', {
          rideId: activeTrip.rideId,
          status: 'arrived',
          driver: vehicleInfo,
        });
      }
      try {
        const token = await getToken();
        if (token) {
          await axios.patch(
            `${API_URL}/drivers/rides/${activeTrip.rideId}/status`,
            { status: 'arrived' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      } catch {
        // Socket already updated
      }
    } else if (tripStage === 'arrived') {
      // Start Trip -> in_progress
      setTripStage('in_progress');
      if (socketRef.current) {
        socketRef.current.emit('ride:status_update', {
          rideId: activeTrip.rideId,
          status: 'in_progress',
          driver: vehicleInfo,
        });
      }
      try {
        const token = await getToken();
        if (token) {
          await axios.patch(
            `${API_URL}/drivers/rides/${activeTrip.rideId}/status`,
            { status: 'in_progress' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      } catch {
        // Socket already updated
      }

      // Route to destination
      if (
        activeTrip.pickupLat &&
        activeTrip.pickupLng &&
        activeTrip.dropoffLat &&
        activeTrip.dropoffLng
      ) {
        fetchRouteForTrip(
          { lat: activeTrip.pickupLat, lng: activeTrip.pickupLng },
          { lat: activeTrip.dropoffLat, lng: activeTrip.dropoffLng }
        );
      }
    } else if (tripStage === 'in_progress') {
      // Complete Trip
      const earned = activeTrip.fareAmount || 150;
      setTodayEarnings((prev) => prev + earned);
      setCompletedTripsCount((prev) => prev + 1);
      setTripStage('completed');

      if (socketRef.current) {
        socketRef.current.emit('ride:status_update', {
          rideId: activeTrip.rideId,
          status: 'completed',
          driver: vehicleInfo,
        });
      }
      try {
        const token = await getToken();
        if (token) {
          await axios.patch(
            `${API_URL}/drivers/rides/${activeTrip.rideId}/status`,
            { status: 'completed' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      } catch {
        // Socket already updated
      }
    }
  };

  // ─── Reset after Trip Completed ───────────────────────────────────────────
  const handleFinishCompletedTrip = () => {
    setActiveTrip(null);
    setRouteGeometry(null);
    setTripStage('heading_to_pickup');
    setIsOnline(true); // Automatically reset driver status back to ONLINE
  };

  // ─── Simulate Demo Ride Request (for testing without rider tab) ───────────
  const handleSimulateDemoRide = () => {
    if (activeTrip) return;
    const demoRide: IncomingRide = {
      rideId: 'demo-ride-' + Date.now(),
      pickupAddress: 'Bandra Kurla Complex (BKC), Mumbai',
      dropoffAddress: 'Chhatrapati Shivaji Maharaj Airport (BOM), Terminal 2',
      fareAmount: 245.5,
      distanceKm: 7.8,
      durationMinutes: 22,
      rideTier: 'UberGo',
      pickupLat: 19.0662,
      pickupLng: 72.8687,
      dropoffLat: 19.0886,
      dropoffLng: 72.8679,
      riderName: 'Aarav Patel',
      riderPhone: '+91 98201 98765',
    };
    setIncomingRide(demoRide);
    setCountdown(15);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-neutral-900 flex flex-col font-sans select-none">
      {/* ─── Top Uber Driver Header ────────────────────────────────────────── */}
      <header className="z-30 bg-black text-white px-4 md:px-8 py-3.5 flex items-center justify-between border-b border-neutral-800 shadow-md">
        {/* Left: Brand & Return */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs md:text-sm font-semibold text-neutral-400 hover:text-white transition-colors bg-neutral-900 border border-neutral-800 px-3.5 py-1.5 rounded-full shadow-sm"
            title="Return to Rider Mode"
          >
            ← Rider Mode
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl md:text-2xl font-black tracking-tight text-white">Uber</span>
            <span className="bg-white text-black font-extrabold text-[11px] px-2 py-0.5 rounded tracking-wide uppercase">
              Driver
            </span>
          </div>
        </div>

        {/* Center: Live GPS Telemetry, Vehicle & Cash Earnings */}
        <div className="hidden lg:flex items-center gap-4">
          {/* Live Telemetry Pill */}
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3.5 py-1.5 rounded-xl font-mono text-xs text-neutral-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>📍 Lat: {driverPos.lat.toFixed(4)} | Lng: {driverPos.lng.toFixed(4)}</span>
            <span className="text-neutral-500 font-sans text-[11px]">(Live GPS Tracking)</span>
          </div>

          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3.5 py-1.5 rounded-xl">
            <Car size={15} className="text-neutral-400" />
            <span className="text-xs font-semibold text-neutral-200">
              Rajesh Sharma · {vehicleInfo.color} Swift
            </span>
            <span className="text-[11px] font-mono bg-neutral-800 text-neutral-200 px-1.5 py-0.5 rounded font-bold">
              {vehicleInfo.plate}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3.5 py-1.5 rounded-xl">
            <span className="text-sm">💵</span>
            <span className="text-xs text-neutral-400">Today:</span>
            <span className="text-sm font-bold text-white">₹{todayEarnings.toFixed(0)}</span>
            <span className="text-xs text-neutral-400">({completedTripsCount} trips completed)</span>
          </div>
        </div>

        {/* Right: Online Toggle & User */}
        <div className="flex items-center gap-3">
          <button
            id="btn-toggle-driver-status"
            onClick={() => setIsOnline(!isOnline)}
            disabled={!!activeTrip}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs md:text-sm transition-all shadow-md ${
              isOnline
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
            } ${activeTrip ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isOnline ? 'bg-white animate-pulse' : 'bg-red-400'
              }`}
            />
            {isOnline ? 'ONLINE (Ready for Trips)' : 'OFFLINE'}
          </button>

          <UserButton />
        </div>
      </header>

      {/* ─── Main Map Area ─────────────────────────────────────────────────── */}
      <div className="relative flex-1 w-full h-full">
        <Map
          pickupCoords={
            activeTrip?.pickupLat && activeTrip?.pickupLng
              ? { lat: activeTrip.pickupLat, lng: activeTrip.pickupLng }
              : null
          }
          dropoffCoords={
            activeTrip?.dropoffLat && activeTrip?.dropoffLng
              ? { lat: activeTrip.dropoffLat, lng: activeTrip.dropoffLng }
              : null
          }
          routeGeometry={routeGeometry}
          driverLocation={driverPos}
          pickupAddress={activeTrip?.pickupAddress || 'Pickup'}
          dropoffAddress={activeTrip?.dropoffAddress || 'Destination'}
        />

        {/* ─── Status Pill Overlay (Top Map) ─────────────────────────────────── */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/85 backdrop-blur-md text-white border border-neutral-700/60 shadow-xl pointer-events-auto">
            {isOnline ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold tracking-wide">
                  {activeTrip ? 'On active trip' : 'Searching for nearby trip requests in Mumbai…'}
                </span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-500" />
                <span className="text-xs font-semibold text-neutral-400">
                  You are offline. Go online to receive trip alerts.
                </span>
              </>
            )}
          </div>
        </div>

        {/* ─── Simulation Trigger Button (Bottom Left Floating) ──────────────── */}
        {!activeTrip && !incomingRide && isOnline && (
          <div className="absolute bottom-6 left-6 z-20">
            <button
              id="btn-simulate-incoming-ride"
              onClick={handleSimulateDemoRide}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900/90 hover:bg-black text-white text-xs font-bold border border-neutral-700 shadow-2xl backdrop-blur transition-all"
            >
              <Sparkles size={14} className="text-amber-400 animate-spin" />
              Simulate Incoming Ride Request
            </button>
          </div>
        )}

        {/* ─── INCOMING DISPATCH MODAL (Authentic Uber 15s Countdown) ────────── */}
        {incomingRide && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-[420px] bg-white rounded-3xl p-6 shadow-2xl border border-neutral-200 text-black flex flex-col gap-5 animate-scaleUp">
              {/* Header with Circular Countdown */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-black tracking-wider uppercase text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    NEW RIDE REQUEST • CASH TRIP
                  </span>
                  <h3 className="text-3xl font-black mt-2 text-black tracking-tight">
                    ₹{incomingRide.fareAmount?.toFixed(2)}
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">Estimated cash to collect</p>
                </div>

                {/* 15s Circular Animated Countdown */}
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      stroke="#e5e7eb"
                      strokeWidth="5"
                      fill="transparent"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      stroke="#000000"
                      strokeWidth="5"
                      fill="transparent"
                      strokeDasharray="163.36"
                      strokeDashoffset={163.36 - (163.36 * countdown) / 15}
                      strokeLinecap="round"
                      className="transition-all duration-1000 linear"
                    />
                  </svg>
                  <span className="absolute text-lg font-black">{countdown}s</span>
                </div>
              </div>

              {/* Trip Details */}
              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100 flex flex-col gap-3">
                <div className="flex items-center gap-4 text-xs font-semibold text-neutral-700">
                  <span className="flex items-center gap-1">
                    <Navigation size={13} className="text-black" />
                    {incomingRide.distanceKm} km
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock size={13} className="text-black" />
                    {incomingRide.durationMinutes || 18} mins
                  </span>
                  <span>·</span>
                  <span className="text-emerald-700 font-bold">💵 Cash Payment</span>
                </div>

                <div className="h-[1px] bg-neutral-200" />

                {/* Pickup & Dropoff Address */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider">
                        From (Pickup)
                      </div>
                      <div className="text-xs font-semibold text-neutral-900 truncate">
                        {incomingRide.pickupAddress}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 bg-red-500 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider">
                        To (Dropoff)
                      </div>
                      <div className="text-xs font-semibold text-neutral-900 truncate">
                        {incomingRide.dropoffAddress}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  id="btn-decline-dispatch"
                  onClick={handleDeclineRide}
                  className="flex-1 py-3.5 border-2 border-neutral-200 hover:bg-neutral-100 text-neutral-700 font-bold text-sm rounded-2xl transition-all cursor-pointer"
                >
                  DECLINE
                </button>
                <button
                  id="btn-accept-dispatch"
                  onClick={handleAcceptRide}
                  className="flex-[2] py-3.5 bg-black hover:bg-neutral-800 text-white font-bold text-sm rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  ACCEPT RIDE
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── ACTIVE TRIP NAVIGATION DRAWER (Bottom Fixed) ──────────────────── */}
        {activeTrip && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-[460px] px-4">
            <div className="bg-white rounded-3xl p-5 shadow-2xl border border-neutral-200 text-black flex flex-col gap-4 animate-fadeInUp">
              {/* Trip Stage Indicator Banner */}
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      tripStage === 'completed'
                        ? 'bg-emerald-500'
                        : 'bg-black animate-pulse'
                    }`}
                  />
                  <span className="text-xs font-black uppercase tracking-wider text-neutral-800">
                    {tripStage === 'heading_to_pickup' && '🚗 Heading to Pickup'}
                    {tripStage === 'arrived' && '📍 Arrived at Pickup'}
                    {tripStage === 'in_progress' && '🏎️ On Route to Destination'}
                    {tripStage === 'completed' && '🎉 Trip Completed!'}
                  </span>
                </div>
                <span className="text-base font-extrabold text-black">
                  ₹{activeTrip.fareAmount?.toFixed(2)}
                </span>
              </div>

              {/* Passenger & Destination Details */}
              {tripStage !== 'completed' ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-black">
                        {activeTrip.riderName || 'Passenger (Rider)'}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {tripStage === 'heading_to_pickup'
                          ? `Pickup: ${activeTrip.pickupAddress.split(',')[0]}`
                          : `Drop: ${activeTrip.dropoffAddress.split(',')[0]}`}
                      </div>
                    </div>
                    {activeTrip.riderPhone && (
                      <a
                        href={`tel:${activeTrip.riderPhone}`}
                        className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-all"
                        title="Call Passenger"
                      >
                        <Phone size={16} className="text-neutral-700" />
                      </a>
                    )}
                  </div>

                  {/* Stage Action CTA Button */}
                  <button
                    id="btn-advance-trip-stage"
                    onClick={handleAdvanceTripStage}
                    className="w-full py-4 bg-black hover:bg-neutral-800 text-white font-bold text-base rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {tripStage === 'heading_to_pickup' && 'ARRIVED AT PICKUP'}
                    {tripStage === 'arrived' && 'START TRIP'}
                    {tripStage === 'in_progress' && `COMPLETE TRIP & COLLECT ₹${activeTrip.fareAmount?.toFixed(0)} CASH`}
                    <ChevronRight size={18} />
                  </button>
                </>
              ) : (
                /* Trip Completed View */
                <div className="text-center py-2 flex flex-col gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                    <CheckCircle size={28} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-black">Payment Received!</h4>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      ₹{activeTrip.fareAmount?.toFixed(2)} credited to your driver wallet.
                    </p>
                  </div>
                  <button
                    id="btn-back-online"
                    onClick={handleFinishCompletedTrip}
                    className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white font-bold text-sm rounded-2xl transition-all shadow-md"
                  >
                    BACK ONLINE FOR TRIPS
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
