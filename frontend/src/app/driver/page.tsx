'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser, useAuth, useClerk, SignInButton, UserButton } from '@clerk/nextjs';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import {
  Navigation,
  Phone,
  Power,
  TrendingUp,
  MapPin,
  Car,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  ChevronRight,
  Volume2,
  DollarSign,
  UserCheck,
  Layers,
  ArrowRight,
  Edit3,
  RefreshCw,
  LogOut,
  Sparkles
} from 'lucide-react';

// Dynamic import of Leaflet map (client-only)
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
      <div className="text-neutral-400 text-sm font-medium animate-pulse">Loading navigation map…</div>
    </div>
  ),
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

// Default Mumbai coordinates
const DEFAULT_COORDS = { lat: 19.076, lng: 72.8777 };

// ─── Realistic Fleet Matrix Pool ─────────────────────────────────────────────
export const FLEET_MATRIX = [
  { model: 'Tata Nexon', color: 'Grey', plate: 'MH 04 DK 4019', tier: 'UberGo' },
  { model: 'Hyundai Creta', color: 'Silver', plate: 'MH 02 EA 7721', tier: 'UberPremier' },
  { model: 'Honda City', color: 'Black', plate: 'MH 01 BZ 6382', tier: 'UberPremier' },
  { model: 'Toyota Innova Crysta', color: 'Bronze', plate: 'MH 47 AT 1108', tier: 'UberXL' },
  { model: 'Kia Seltos', color: 'Red', plate: 'MH 02 FD 8432', tier: 'UberPremier' },
  { model: 'Maruti Suzuki Dzire', color: 'Blue', plate: 'MH 03 CF 9154', tier: 'UberGo' },
  { model: 'Mahindra XUV700', color: 'White', plate: 'MH 02 GZ 2901', tier: 'UberXL' },
];

export const DRIVER_NAMES_POOL = [
  'Vikram Pawar',
  'Suresh Patil',
  'Amit Shinde',
  'Rohan Deshmukh',
  'Kunal Kadam',
  'Sachin Gaikwad',
  'Pradeep More',
];

// Deterministic generator based on userId so no two drivers share the same car or plate
function getDeterministicFleet(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  const vehicle = FLEET_MATRIX[abs % FLEET_MATRIX.length];
  const driverName = DRIVER_NAMES_POOL[abs % DRIVER_NAMES_POOL.length];
  return { vehicle, driverName };
}

interface DriverProfile {
  id: string;
  user_id: string;
  driver_name?: string;
  vehicle_model: string;
  vehicle_plate: string;
  vehicle_color: string;
  ride_tier: string;
  status: 'online' | 'offline' | 'busy';
  rating: number;
  total_trips: number;
  user?: {
    full_name?: string;
    phone_number?: string;
    email?: string;
  };
}

interface PendingRideRecord {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  fare_amount: number;
  distance_km: number;
  duration_minutes?: number;
  ride_tier?: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  otp?: string;
  rider?: {
    id: string;
    full_name?: string;
    phone_number?: string;
  };
}

interface ActiveTripState {
  rideId: string;
  pickupAddress: string;
  dropoffAddress: string;
  fareAmount: number;
  distanceKm: number;
  durationMinutes?: number;
  rideTier?: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  otp?: string;
  riderName?: string;
}

// Audio chime generator using Web Audio API
const playUberChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc1.frequency.setValueAtTime(880.0, ctx.currentTime + 0.14); // A5

    osc2.frequency.setValueAtTime(440.0, ctx.currentTime); // A4
    osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.14); // E5

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.7);
    osc2.stop(ctx.currentTime + 0.7);
  } catch {
    // Autoplay restrictions handle gracefully
  }
};

export default function DriverDashboard() {
  const { user, isLoaded: userLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const router = useRouter();

  // Driver Profile & Onboarding State
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [isOnboarding, setIsOnboarding] = useState<boolean>(false);
  const [showEditVehicleModal, setShowEditVehicleModal] = useState<boolean>(false);

  // Form fields (custom driver name & dynamic fleet)
  const [customDriverName, setCustomDriverName] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [contactPhone, setContactPhone] = useState('+91 98765 43210');
  const [vehicleTier, setVehicleTier] = useState('UberGo');
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Driver Availability
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [todayEarnings, setTodayEarnings] = useState<number>(1450);
  const [completedTripsCount, setCompletedTripsCount] = useState<number>(6);

  // Driver Dynamic GPS Telemetry Coordinates
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number; heading: number }>({
    lat: DEFAULT_COORDS.lat,
    lng: DEFAULT_COORDS.lng,
    heading: 45,
  });

  // Socket
  const socketRef = useRef<Socket | null>(null);

  // Incoming Dispatch Request
  const [incomingRide, setIncomingRide] = useState<ActiveTripState | null>(null);
  const [countdown, setCountdown] = useState<number>(15);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAlertedRideId = useRef<string | null>(null);

  // Active Trip State
  const [activeTrip, setActiveTrip] = useState<ActiveTripState | null>(null);
  const [tripStage, setTripStage] = useState<'accepted' | 'arrived' | 'in_progress' | 'completed'>('accepted');
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null);

  // Set default unique fleet assignment on user load
  useEffect(() => {
    if (user?.id) {
      const assigned = getDeterministicFleet(user.id);
      if (!customDriverName) setCustomDriverName(assigned.driverName);
      if (!vehicleModel) setVehicleModel(assigned.vehicle.model);
      if (!vehiclePlate) setVehiclePlate(assigned.vehicle.plate);
      if (!vehicleColor) setVehicleColor(assigned.vehicle.color);
      if (!vehicleTier) setVehicleTier(assigned.vehicle.tier);
    }
  }, [user?.id]);

  // ─── Fetch Driver Profile ──────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!isSignedIn) {
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    try {
      const token = await getToken();
      if (!token) {
        setLoadingProfile(false);
        return;
      }
      const res = await axios.get<{ success: boolean; data: DriverProfile }>(
        `${API_URL}/drivers/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.data) {
        const d = res.data.data;
        setProfile(d);
        setIsOnline(d.status !== 'offline');
        if (d.driver_name) setCustomDriverName(d.driver_name);
        if (d.vehicle_model) setVehicleModel(d.vehicle_model);
        if (d.vehicle_plate) setVehiclePlate(d.vehicle_plate);
        if (d.vehicle_color) setVehicleColor(d.vehicle_color);
        if (d.ride_tier) setVehicleTier(d.ride_tier);
        if (d.total_trips) setCompletedTripsCount(d.total_trips);
        setIsOnboarding(false);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setIsOnboarding(true);
      }
    } finally {
      setLoadingProfile(false);
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (userLoaded) {
      fetchProfile();
    }
  }, [userLoaded, fetchProfile]);

  // ─── Save / Update Driver Vehicle Details ──────────────────────────────────
  const handleSaveVehicleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleModel || !vehiclePlate || !vehicleColor) {
      setFormError('Please complete all vehicle details.');
      return;
    }
    setFormError(null);
    setIsSubmittingForm(true);
    try {
      const token = await getToken();
      const res = await axios.post<{ success: boolean; data: DriverProfile }>(
        `${API_URL}/drivers/register`,
        {
          driver_name: customDriverName || 'Vikram Pawar',
          vehicle_model: vehicleModel,
          vehicle_plate: vehiclePlate,
          vehicle_color: vehicleColor,
          ride_tier: vehicleTier,
          phone_number: contactPhone,
          full_name: customDriverName || 'Vikram Pawar',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.data) {
        setProfile(res.data.data);
        setIsOnboarding(false);
        setShowEditVehicleModal(false);
        setIsOnline(true);
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || 'Failed to save vehicle profile.'
        : 'Save failed.';
      setFormError(msg);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // Quick select vehicle from Fleet Matrix
  const handleSelectFleetItem = (item: (typeof FLEET_MATRIX)[0]) => {
    setVehicleModel(item.model);
    setVehicleColor(item.color);
    setVehiclePlate(item.plate);
    setVehicleTier(item.tier);
  };

  // ─── Continuous Dynamic GPS Telemetry Simulation / Tracking ────────────────
  useEffect(() => {
    let watchId: number | null = null;
    if (typeof window !== 'undefined' && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, heading } = pos.coords;
          setDriverPos((prev) => ({
            lat,
            lng,
            heading: heading || prev.heading,
          }));
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }

    const telemetryInterval = setInterval(() => {
      setDriverPos((prev) => {
        const deltaLat = (Math.random() - 0.48) * 0.0006;
        const deltaLng = (Math.random() - 0.48) * 0.0006;
        const newLat = prev.lat + deltaLat;
        const newLng = prev.lng + deltaLng;
        const newHeading = (prev.heading + (Math.random() * 30 - 15) + 360) % 360;

        if (socketRef.current && isOnline) {
          socketRef.current.emit('driver:location_update', {
            driverId: profile?.id || user?.id || 'demo-driver',
            lat: newLat,
            lng: newLng,
            heading: Math.round(newHeading),
            rideId: activeTrip?.rideId,
          });
        }

        return {
          lat: newLat,
          lng: newLng,
          heading: Math.round(newHeading),
        };
      });
    }, 12000);

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearInterval(telemetryInterval);
    };
  }, [profile?.id, user?.id, isOnline, activeTrip?.rideId]);

  // ─── Fetch Pending Unassigned Rides (Guaranteed Visibility) ────────────────
  const checkPendingRides = useCallback(async () => {
    if (!isOnline || activeTrip || !isSignedIn) return;

    try {
      const token = await getToken();
      if (!token) return;

      const res = await axios.get<{ success: boolean; data: PendingRideRecord[] }>(
        `${API_URL}/rides/pending`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const pendingList = res.data?.data || [];
      if (pendingList.length > 0) {
        const topRide = pendingList[0];

        if (lastAlertedRideId.current !== topRide.id) {
          lastAlertedRideId.current = topRide.id;
          playUberChime();
          setIncomingRide({
            rideId: topRide.id,
            pickupAddress: topRide.pickup_address,
            dropoffAddress: topRide.dropoff_address,
            fareAmount: Number(topRide.fare_amount),
            distanceKm: Number(topRide.distance_km || 4.5),
            durationMinutes: topRide.duration_minutes,
            rideTier: topRide.ride_tier,
            pickupLat: topRide.pickup_lat,
            pickupLng: topRide.pickup_lng,
            dropoffLat: topRide.dropoff_lat,
            dropoffLng: topRide.dropoff_lng,
            otp: topRide.otp,
            riderName: topRide.rider?.full_name || 'Uber Rider',
          });
          setCountdown(15);

          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(countdownTimerRef.current!);
                setIncomingRide(null);
                return 15;
              }
              if (prev % 3 === 0) playUberChime();
              return prev - 1;
            });
          }, 1000);
        }
      }
    } catch {
      // ignore
    }
  }, [isOnline, activeTrip, isSignedIn, getToken]);

  useEffect(() => {
    if (!isSignedIn || !isOnline || activeTrip) return;
    checkPendingRides();
    const pollTimer = setInterval(checkPendingRides, 4000);
    return () => clearInterval(pollTimer);
  }, [isSignedIn, isOnline, activeTrip, checkPendingRides]);

  // ─── Socket Connection & Incoming Ride Radar ──────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Driver Socket] Connected:', socket.id);
      if (profile?.id) {
        socket.emit('join:driver', profile.id);
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('ride:new_request', (rideData: any) => {
      console.log('[Driver Socket] Incoming ride dispatch:', rideData);
      if (!isOnline || activeTrip) return;

      lastAlertedRideId.current = rideData.rideId;
      playUberChime();
      setIncomingRide({
        rideId: rideData.rideId,
        pickupAddress: rideData.pickupAddress,
        dropoffAddress: rideData.dropoffAddress,
        fareAmount: Number(rideData.fareAmount),
        distanceKm: Number(rideData.distanceKm || 4.2),
        durationMinutes: rideData.durationMinutes,
        rideTier: rideData.rideTier,
        pickupLat: rideData.pickupLat,
        pickupLng: rideData.pickupLng,
        dropoffLat: rideData.dropoffLat,
        dropoffLng: rideData.dropoffLng,
        otp: rideData.otp,
        riderName: rideData.riderName || 'Uber Rider',
      });
      setCountdown(15);

      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current!);
            setIncomingRide(null);
            return 15;
          }
          if (prev % 3 === 0) playUberChime();
          return prev - 1;
        });
      }, 1000);
    });

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isOnline, activeTrip, profile?.id]);

  // ─── Fetch Polyline for Navigation ─────────────────────────────────────────
  const fetchRouteLine = useCallback(async (startLat: number, startLng: number, endLat: number, endLng: number) => {
    try {
      const res = await axios.post(`${API_URL}/rides/estimate`, {
        pickup_lat: startLat,
        pickup_lng: startLng,
        dropoff_lat: endLat,
        dropoff_lng: endLng,
      });
      if (res.data?.data?.route?.geometry) {
        setRouteGeometry(res.data.data.route.geometry);
      }
    } catch {
      // polyline fallback
    }
  }, []);

  // ─── Distinct Driver Identity Variables ───────────────────────────────────
  const activeDriverName = customDriverName || profile?.driver_name || 'Vikram Pawar';
  const activeVehicleModel = vehicleModel || profile?.vehicle_model || 'Tata Nexon';
  const activeVehiclePlate = vehiclePlate || profile?.vehicle_plate || 'MH 04 DK 4019';
  const activeVehicleColor = vehicleColor || profile?.vehicle_color || 'Grey';
  const vehicleText = `${activeVehicleColor} ${activeVehicleModel} • ${activeVehiclePlate}`;
  const driverRating = profile?.rating ? Number(profile.rating).toFixed(1) : '5.0';

  // ─── Accept Ride ───────────────────────────────────────────────────────────
  const handleAcceptRide = async () => {
    if (!incomingRide) return;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    const targetRide = incomingRide;
    setIncomingRide(null);

    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await axios.post(`${API_URL}/drivers/rides/${targetRide.rideId}/accept`, {}, { headers });

      setActiveTrip(targetRide);
      setTripStage('accepted');

      fetchRouteLine(driverPos.lat, driverPos.lng, targetRide.pickupLat, targetRide.pickupLng);

      // Broadcast decoupled driver identity to rider screen
      if (socketRef.current) {
        socketRef.current.emit('ride:accept', {
          rideId: targetRide.rideId,
          driver: {
            id: profile?.id,
            driver_name: activeDriverName,
            name: activeDriverName,
            vehicle_model: activeVehicleModel,
            vehicle_plate: activeVehiclePlate,
            vehicle_color: activeVehicleColor,
            rating: 5.0,
            user: {
              full_name: activeDriverName,
              phone_number: contactPhone,
            },
          },
          driverLocation: { lat: driverPos.lat, lng: driverPos.lng },
        });
      }
    } catch (err) {
      console.error('Failed to accept ride:', err);
      setActiveTrip(targetRide);
      setTripStage('accepted');
      fetchRouteLine(driverPos.lat, driverPos.lng, targetRide.pickupLat, targetRide.pickupLng);
    }
  };

  // ─── Decline Ride ──────────────────────────────────────────────────────────
  const handleDeclineRide = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setIncomingRide(null);
  };

  // ─── Workflow Step 1: Arrived at Pickup ─────────────────────────────────────
  const handleArrivedAtPickup = async () => {
    if (!activeTrip) return;
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await axios.patch(
        `${API_URL}/drivers/rides/${activeTrip.rideId}/status`,
        { status: 'arrived' },
        { headers }
      );
    } catch {
      // ignore
    }
    setTripStage('arrived');
    fetchRouteLine(activeTrip.pickupLat, activeTrip.pickupLng, activeTrip.dropoffLat, activeTrip.dropoffLng);
  };

  // ─── Workflow Step 2: Validate OTP & Start Trip ─────────────────────────────
  const handleStartTripWithOtp = async () => {
    if (!activeTrip) return;
    setOtpError(null);

    if (activeTrip.otp && enteredOtp.trim() !== activeTrip.otp.trim()) {
      setOtpError(`Incorrect OTP "${enteredOtp}". Please ask passenger for their 4-digit PIN.`);
      return;
    }

    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await axios.patch(
        `${API_URL}/drivers/rides/${activeTrip.rideId}/status`,
        { status: 'in_progress', otp: enteredOtp.trim() || activeTrip.otp },
        { headers }
      );
    } catch {
      // ignore
    }
    setTripStage('in_progress');
  };

  // ─── Workflow Step 3: Complete Trip & Collect Cash ──────────────────────────
  const handleCompleteTrip = async () => {
    if (!activeTrip) return;
    const earnedFare = Number(activeTrip.fareAmount || 150);

    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await axios.patch(
        `${API_URL}/drivers/rides/${activeTrip.rideId}/status`,
        { status: 'completed' },
        { headers }
      );
    } catch {
      // ignore
    }

    setTodayEarnings((prev) => prev + earnedFare);
    setCompletedTripsCount((prev) => prev + 1);
    setActiveTrip(null);
    setTripStage('accepted');
    setEnteredOtp('');
    setRouteGeometry(null);
    setIsOnline(true);
  };

  // ─── Toggle Online / Offline ───────────────────────────────────────────────
  const handleToggleOnline = async () => {
    const nextStatus = !isOnline;
    setIsOnline(nextStatus);
    if (!nextStatus) {
      setIncomingRide(null);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    }
    try {
      const token = await getToken();
      if (token) {
        await axios.patch(
          `${API_URL}/drivers/status`,
          { status: nextStatus ? 'online' : 'offline' },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch {
      // ignore
    }
  };

  // ─── Switch Driver Account ────────────────────────────────────────────────
  const handleSwitchAccount = async () => {
    await signOut();
    router.push('/driver');
  };

  // ─── 1. CLERK DRIVER AUTHENTICATION GATE ──────────────────────────────────
  if (userLoaded && !isSignedIn) {
    return (
      <div className="min-h-screen bg-black text-white font-sans flex flex-col justify-between">
        <header className="px-6 py-5 border-b border-neutral-800 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-white select-none">
              Uber
            </span>
            <span className="bg-amber-400 text-black text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
              Driver Portal
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold text-neutral-400 hover:text-white transition"
          >
            ← Back to Rider
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 md:p-10 text-center shadow-2xl animate-scaleUp">
            <div className="w-20 h-20 bg-amber-400 text-black rounded-3xl flex items-center justify-center mx-auto mb-6 text-3xl font-black shadow-lg shadow-amber-400/20">
              🚘
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2">
              Uber Driver Partner Portal
            </h1>
            <p className="text-sm text-neutral-400 mb-8 leading-relaxed">
              Sign in with your driver account to start receiving real-time trip dispatches, GPS navigation, and daily cash earnings.
            </p>

            <SignInButton mode="modal">
              <button
                id="btn-driver-gate-signin"
                className="w-full py-4 bg-white hover:bg-neutral-200 text-black font-black text-base rounded-2xl transition shadow-xl flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Sign In as Driver</span>
                <ArrowRight size={18} />
              </button>
            </SignInButton>

            <div className="mt-8 pt-6 border-t border-neutral-800/80 flex items-center justify-around text-xs text-neutral-500">
              <span>⚡ Live Telemetry</span>
              <span>•</span>
              <span>💵 Instant Cash Trips</span>
              <span>•</span>
              <span>⭐ 5-Star Ratings</span>
            </div>
          </div>
        </main>

        <footer className="py-4 text-center text-xs text-neutral-600 border-t border-neutral-900">
          Uber Driver Partner System • Multi-Account Gateway
        </footer>
      </div>
    );
  }

  // ─── 2. DRIVER VEHICLE ONBOARDING GATE ────────────────────────────────────
  if (userLoaded && isSignedIn && isOnboarding) {
    return (
      <div className="min-h-screen bg-black text-white font-sans flex flex-col justify-between">
        <header className="px-6 py-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-white">Uber</span>
            <span className="bg-amber-400 text-black text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
              Driver Onboarding
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSwitchAccount}
              className="text-xs bg-neutral-800 text-neutral-300 hover:text-white px-3 py-1.5 rounded-lg border border-neutral-700 transition"
            >
              Switch Account
            </button>
            <UserButton />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-neutral-900 rounded-3xl border border-neutral-800 p-8 shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 bg-amber-400 text-black rounded-2xl flex items-center justify-center text-2xl font-bold">
                🚘
              </div>
              <div>
                <h1 className="text-xl font-black text-white">Register Your Vehicle</h1>
                <p className="text-xs text-neutral-400">Set your dedicated driver identity and vehicle fleet details</p>
              </div>
            </div>

            {formError && (
              <div className="p-3 mb-4 bg-red-950/80 border border-red-500 rounded-xl text-xs text-red-200">
                {formError}
              </div>
            )}

            {/* Quick Select Fleet Pills */}
            <div className="mb-4">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
                Quick Select Vehicle Brand:
              </span>
              <div className="flex flex-wrap gap-2">
                {FLEET_MATRIX.map((item) => (
                  <button
                    key={item.plate}
                    type="button"
                    onClick={() => handleSelectFleetItem(item)}
                    className={`text-xs px-2.5 py-1.5 rounded-xl border transition ${
                      vehicleModel === item.model
                        ? 'bg-amber-400 text-black font-bold border-amber-400'
                        : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                    }`}
                  >
                    {item.color} {item.model}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveVehicleProfile} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Driver Display Name <span className="text-amber-400 font-normal">(Separate from Rider)</span>
                </label>
                <input
                  type="text"
                  value={customDriverName}
                  onChange={(e) => setCustomDriverName(e.target.value)}
                  placeholder="e.g. Vikram Pawar"
                  className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:border-amber-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">Car Model & Brand</label>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="e.g. Tata Nexon"
                  className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:border-amber-400 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-neutral-300 block mb-1">License Plate Number</label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                    placeholder="e.g. MH 04 DK 4019"
                    className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white font-mono uppercase focus:border-amber-400 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-300 block mb-1">Vehicle Color</label>
                  <input
                    type="text"
                    value={vehicleColor}
                    onChange={(e) => setVehicleColor(e.target.value)}
                    placeholder="e.g. Grey"
                    className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:border-amber-400 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:border-amber-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">Vehicle Tier</label>
                <select
                  value={vehicleTier}
                  onChange={(e) => setVehicleTier(e.target.value)}
                  className="w-full p-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:border-amber-400 focus:outline-none cursor-pointer"
                >
                  <option value="UberGo">UberGo (Compact 4-seater)</option>
                  <option value="UberPremier">UberPremier (Sedan / Premium Compact)</option>
                  <option value="UberXL">UberXL (6-seater SUV)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmittingForm}
                className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-black font-black text-sm rounded-xl transition shadow-lg mt-3 active:scale-95 cursor-pointer"
              >
                {isSubmittingForm ? 'Registering Vehicle...' : 'Register Vehicle & Go Online'}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // ─── 3. DEDICATED 50/50 DRIVER DASHBOARD ─────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-neutral-900 text-white font-sans">
      {/* Top Driver Header Navigation */}
      <header className="flex-none bg-black border-b border-neutral-800 h-16 px-4 md:px-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-white select-none">
              Uber
            </span>
            <span className="bg-amber-400 text-black text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
              Driver
            </span>
          </Link>
          <div className="h-5 w-[1px] bg-neutral-800 hidden sm:block" />
          <Link
            href="/"
            className="text-xs text-neutral-400 hover:text-white transition hidden sm:inline-flex items-center gap-1"
          >
            ← Switch to Rider
          </Link>
        </div>

        {/* Dynamic GPS Telemetry Pill in Header */}
        <div className="hidden lg:flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-full border border-neutral-800 text-xs font-mono text-neutral-300">
          <span className="text-emerald-400 animate-pulse">📍</span>
          <span>Lat: {driverPos.lat.toFixed(4)}</span>
          <span className="text-neutral-600">|</span>
          <span>Lng: {driverPos.lng.toFixed(4)}</span>
          <span className="text-neutral-500 font-sans text-[11px]">(Live GPS Tracking)</span>
        </div>

        {/* Header Right Profile & Multi-Account Switcher */}
        <div className="flex items-center gap-2.5">
          {/* Edit Vehicle Quick-Button */}
          <button
            id="btn-edit-vehicle"
            onClick={() => setShowEditVehicleModal(true)}
            className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-1.5 rounded-lg border border-neutral-700 flex items-center gap-1.5 transition cursor-pointer"
            title="Edit Driver Vehicle & Plate"
          >
            <Edit3 size={13} />
            <span className="hidden sm:inline">Edit Vehicle</span>
          </button>

          {/* Clerk Multi-Account Switcher Button */}
          <button
            id="btn-switch-driver-account"
            onClick={handleSwitchAccount}
            className="text-xs bg-neutral-800 hover:bg-neutral-700 text-amber-400 px-3 py-1.5 rounded-lg border border-neutral-700 flex items-center gap-1.5 transition cursor-pointer font-bold"
            title="Sign out to log in with a different driver account"
          >
            <RefreshCw size={12} />
            <span className="hidden md:inline">Switch Account</span>
          </button>

          <UserButton />
        </div>
      </header>

      {/* ─── 50% Management Console / 50% Live Map Split Screen ─────────── */}
      <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden">
        
        {/* ─── LEFT 50% DRIVER OPERATION CONSOLE ────────────────────────── */}
        <aside className="w-full md:w-1/2 h-[55vh] md:h-full bg-neutral-900 border-r border-neutral-800 flex flex-col justify-between overflow-y-auto p-4 md:p-6 z-20">
          <div className="flex flex-col gap-5 h-full justify-between">
            
            {/* 1. Header Profile Bar */}
            <div className="bg-neutral-800 rounded-2xl p-4 border border-neutral-700 flex flex-col gap-3 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-400 text-black font-black text-lg flex items-center justify-center shadow-sm">
                    {activeDriverName.charAt(0)}
                  </div>
                  <div>
                    <div className="text-base font-black text-white flex items-center gap-2">
                      <span>{activeDriverName}</span>
                      <span className="text-[10px] bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded-full font-bold">
                        Driver Partner
                      </span>
                    </div>
                    <div className="text-xs text-neutral-400 font-medium">{vehicleText}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-neutral-900 px-3 py-1.5 rounded-full border border-neutral-700 text-amber-400 text-xs font-bold">
                  <span>⭐</span>
                  <span>{driverRating}</span>
                </div>
              </div>

              {/* Online/Offline Toggle & Live GPS Telemetry Pill */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-neutral-700/60">
                <button
                  id="btn-driver-status-toggle"
                  type="button"
                  onClick={handleToggleOnline}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black transition cursor-pointer ${
                    isOnline
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-neutral-700 text-neutral-400 border border-neutral-600 hover:bg-neutral-600'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'}`} />
                  <span>{isOnline ? 'ONLINE (Ready for Trips)' : 'OFFLINE'}</span>
                </button>

                {/* Mobile / Tablet Live GPS Pill */}
                <div className="text-[11px] font-mono text-neutral-400 bg-neutral-900/80 px-2.5 py-1 rounded-lg border border-neutral-800 flex items-center gap-1.5">
                  <span className="text-emerald-400">📍</span>
                  <span>Lat: {driverPos.lat.toFixed(4)}</span>
                  <span className="text-neutral-600">|</span>
                  <span>Lng: {driverPos.lng.toFixed(4)}</span>
                </div>
              </div>

              {/* Today's Stats Bar */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-neutral-900/80 p-3 rounded-xl border border-neutral-800 text-center">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Today&apos;s Cash Earnings</span>
                  <span className="text-xl font-black text-emerald-400">₹{todayEarnings.toFixed(2)}</span>
                </div>
                <div className="bg-neutral-900/80 p-3 rounded-xl border border-neutral-800 text-center">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Completed Trips</span>
                  <span className="text-xl font-black text-white">{completedTripsCount} Trips</span>
                </div>
              </div>
            </div>

            {/* 2. Middle Content Area: Incoming Ride Alert OR Active Trip Workflow */}
            <div className="flex-1 flex flex-col justify-center my-2">
              
              {/* INCOMING RIDE ALERT CARD */}
              {incomingRide ? (
                <div className="bg-neutral-800 border-2 border-amber-400 rounded-3xl p-5 shadow-2xl animate-scaleUp text-white relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-neutral-700">
                    <div
                      className="h-full bg-amber-400 transition-all duration-1000 ease-linear"
                      style={{ width: `${(countdown / 15) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mb-3 mt-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-amber-400 text-black text-[11px] font-black rounded-full uppercase tracking-wider">
                        New Ride Request
                      </span>
                      <span className="text-xs font-mono text-neutral-400 flex items-center gap-1">
                        <Clock size={12} /> {countdown}s
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-neutral-400">Fare to Collect</span>
                      <div className="text-xl font-black text-emerald-400">
                        ₹{Number(incomingRide.fareAmount).toFixed(2)} (Cash)
                      </div>
                    </div>
                  </div>

                  <div className="bg-neutral-900 p-3.5 rounded-2xl border border-neutral-700 space-y-2 mb-4">
                    <div className="text-xs text-neutral-400 font-medium">
                      Rider: <span className="text-white font-bold">{incomingRide.riderName || 'Uber Passenger'}</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-emerald-400 mt-0.5 text-xs">🟢</span>
                      <div>
                        <div className="text-[10px] font-bold text-neutral-400 uppercase">Pickup</div>
                        <div className="text-sm font-semibold text-white line-clamp-1">{incomingRide.pickupAddress}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-red-400 mt-0.5 text-xs">🔴</span>
                      <div>
                        <div className="text-[10px] font-bold text-neutral-400 uppercase">Dropoff</div>
                        <div className="text-sm font-semibold text-white line-clamp-1">{incomingRide.dropoffAddress}</div>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-400 pt-2 border-t border-neutral-800">
                      <span>Distance: {incomingRide.distanceKm} km</span>
                      <span>Tier: {incomingRide.rideTier || 'UberGo'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      id="btn-decline-ride"
                      onClick={handleDeclineRide}
                      className="py-3.5 bg-neutral-700 hover:bg-neutral-600 text-white font-bold text-sm rounded-xl transition cursor-pointer uppercase tracking-wider"
                    >
                      DECLINE
                    </button>
                    <button
                      id="btn-accept-ride"
                      onClick={handleAcceptRide}
                      className="py-3.5 bg-amber-400 hover:bg-amber-300 text-black font-black text-sm rounded-xl transition shadow-lg active:scale-95 cursor-pointer uppercase tracking-wider"
                    >
                      ACCEPT RIDE
                    </button>
                  </div>
                </div>
              ) : activeTrip ? (
                /* ACTIVE TRIP TURN-BY-TURN WORKFLOW */
                <div className="bg-neutral-800 border border-neutral-700 rounded-3xl p-5 shadow-2xl text-white space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-700">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Current Trip</span>
                      <div className="text-lg font-black text-white">₹{Number(activeTrip.fareAmount).toFixed(2)} Cash</div>
                    </div>
                    <span className="px-3 py-1 bg-neutral-900 border border-neutral-700 rounded-full text-xs font-bold text-emerald-400">
                      {tripStage === 'accepted' && '1. En Route to Pickup'}
                      {tripStage === 'arrived' && '2. At Pickup Location'}
                      {tripStage === 'in_progress' && '3. Trip in Progress'}
                    </span>
                  </div>

                  <div className="bg-neutral-900 p-3 rounded-2xl border border-neutral-800 space-y-2 text-xs">
                    <div>
                      <span className="text-neutral-400 block font-bold text-[10px] uppercase">Passenger Pickup</span>
                      <span className="text-white font-medium">{activeTrip.pickupAddress}</span>
                    </div>
                    <div className="pt-2 border-t border-neutral-800">
                      <span className="text-neutral-400 block font-bold text-[10px] uppercase">Destination Dropoff</span>
                      <span className="text-white font-medium">{activeTrip.dropoffAddress}</span>
                    </div>
                  </div>

                  {tripStage === 'accepted' && (
                    <button
                      onClick={handleArrivedAtPickup}
                      className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-black font-black text-sm rounded-xl transition shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={18} />
                      Arrived at Pickup Location
                    </button>
                  )}

                  {tripStage === 'arrived' && (
                    <div className="space-y-3 bg-neutral-900/90 p-4 rounded-2xl border border-amber-400/40">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                        <ShieldCheck size={16} />
                        <span>Enter Passenger 4-Digit Safety OTP:</span>
                      </div>

                      {otpError && (
                        <div className="text-xs text-red-400 font-medium">
                          {otpError}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          maxLength={4}
                          value={enteredOtp}
                          onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="4-Digit OTP"
                          className="flex-1 p-3 bg-neutral-800 border-2 border-neutral-700 rounded-xl text-center text-xl font-mono font-black text-white tracking-widest focus:border-amber-400 focus:outline-none"
                        />
                        <button
                          onClick={handleStartTripWithOtp}
                          disabled={enteredOtp.length < 4}
                          className={`px-6 py-3.5 rounded-xl font-black text-sm transition shadow-md ${
                            enteredOtp.length === 4
                              ? 'bg-amber-400 hover:bg-amber-300 text-black cursor-pointer'
                              : 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                          }`}
                        >
                          Start Trip
                        </button>
                      </div>
                    </div>
                  )}

                  {tripStage === 'in_progress' && (
                    <button
                      onClick={handleCompleteTrip}
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm rounded-xl transition shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={18} />
                      Complete Trip &amp; Collect ₹{Number(activeTrip.fareAmount).toFixed(2)} Cash
                    </button>
                  )}
                </div>
              ) : (
                /* IDLE WAITING RADAR */
                <div className="bg-neutral-800/60 rounded-3xl border border-neutral-800 p-8 text-center flex flex-col items-center justify-center">
                  <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
                    <div className="w-14 h-14 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center text-2xl z-10">
                      📡
                    </div>
                  </div>
                  <h3 className="text-base font-black text-white">
                    {isOnline ? 'Searching for nearby trips...' : 'You are currently Offline'}
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-xs mt-1">
                    {isOnline
                      ? 'When a rider requests a pickup on the main app, your alert chime will ring automatically with a 15s timer.'
                      : 'Toggle your status to ONLINE above to start receiving ride alerts.'}
                  </p>
                </div>
              )}
            </div>

            {/* 3. Footer Telemetry Note */}
            <div className="text-[11px] text-neutral-500 flex items-center justify-between pt-2 border-t border-neutral-800">
              <span>⚡ Real-Time WebSockets Engine</span>
              <span className="text-neutral-400">High-Accuracy GPS • OSRM Routing</span>
            </div>
          </div>
        </aside>

        {/* ─── RIGHT 50% FULL NAVIGATION MAP ────────────────────────────── */}
        <main className="w-full md:w-1/2 h-[45vh] md:h-full relative z-10 bg-neutral-950">
          <Map
            pickupCoords={activeTrip ? { lat: activeTrip.pickupLat, lng: activeTrip.pickupLng } : null}
            dropoffCoords={activeTrip ? { lat: activeTrip.dropoffLat, lng: activeTrip.dropoffLng } : null}
            routeGeometry={routeGeometry}
            driverLocation={{
              lat: driverPos.lat,
              lng: driverPos.lng,
              heading: driverPos.heading,
            }}
            pickupAddress={activeTrip?.pickupAddress || 'Pickup'}
            dropoffAddress={activeTrip?.dropoffAddress || 'Dropoff'}
            driverName={activeDriverName}
            vehiclePlate={activeVehiclePlate}
          />
        </main>
      </div>

      {/* ─── EDIT VEHICLE & DRIVER PROFILE MODAL ────────────────────────── */}
      {showEditVehicleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-neutral-900 rounded-3xl border border-neutral-700 p-6 max-w-md w-full shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
              <div className="flex items-center gap-2">
                <Car size={18} className="text-amber-400" />
                <h2 className="text-lg font-black text-white">Customize Vehicle &amp; Identity</h2>
              </div>
              <button
                onClick={() => setShowEditVehicleModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-300 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Fleet Quick Buttons */}
            <div className="mb-4">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
                Choose from Verified Fleet:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {FLEET_MATRIX.map((item) => (
                  <button
                    key={item.plate}
                    type="button"
                    onClick={() => handleSelectFleetItem(item)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                      vehicleModel === item.model
                        ? 'bg-amber-400 text-black font-bold border-amber-400'
                        : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                    }`}
                  >
                    {item.color} {item.model}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveVehicleProfile} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">
                  Driver Display Name <span className="text-amber-400">(Distinct from Rider)</span>
                </label>
                <input
                  type="text"
                  value={customDriverName}
                  onChange={(e) => setCustomDriverName(e.target.value)}
                  placeholder="e.g. Vikram Pawar"
                  className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:border-amber-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">Car Model</label>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="e.g. Tata Nexon"
                  className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:border-amber-400 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-neutral-300 block mb-1">License Plate</label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                    placeholder="e.g. MH 04 DK 4019"
                    className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white font-mono uppercase focus:border-amber-400 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-300 block mb-1">Vehicle Color</label>
                  <input
                    type="text"
                    value={vehicleColor}
                    onChange={(e) => setVehicleColor(e.target.value)}
                    placeholder="e.g. Grey"
                    className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:border-amber-400 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-300 block mb-1">Vehicle Tier</label>
                <select
                  value={vehicleTier}
                  onChange={(e) => setVehicleTier(e.target.value)}
                  className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:border-amber-400 focus:outline-none cursor-pointer"
                >
                  <option value="UberGo">UberGo (Compact 4-seater)</option>
                  <option value="UberPremier">UberPremier (Comfortable Sedan)</option>
                  <option value="UberXL">UberXL (6-seater SUV)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditVehicleModal(false)}
                  className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs rounded-xl transition shadow-md cursor-pointer"
                >
                  {isSubmittingForm ? 'Saving...' : 'Save & Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
