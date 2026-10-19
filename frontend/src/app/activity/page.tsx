'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth, SignInButton } from '@clerk/nextjs';
import axios from 'axios';
import {
  Calendar,
  Clock,
  Car,
  MapPin,
  Star,
  Receipt,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import Navbar from '@/components/Navbar';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

interface DriverDetails {
  id?: string;
  vehicle_model?: string;
  vehicle_plate?: string;
  vehicle_color?: string;
  rating?: number;
  user?: {
    full_name?: string;
    phone_number?: string;
    profile_image_url?: string;
  };
}

interface ReviewDetails {
  id?: string;
  rating: number;
  feedback?: string;
}

interface RideRecord {
  id: string;
  created_at: string;
  pickup_address: string;
  dropoff_address: string;
  fare_amount: number;
  ride_tier: string;
  status: string;
  otp?: string;
  driver?: DriverDetails;
  reviews?: ReviewDetails[] | ReviewDetails;
}

export default function ActivityPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [rides, setRides] = useState<RideRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRide, setSelectedRide] = useState<RideRecord | null>(null);

  const fetchRideHistory = async () => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await axios.get<{ success: boolean; data: RideRecord[] }>(
        `${API_URL}/rides/history`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.data) {
        setRides(res.data.data);
      }
    } catch (err: unknown) {
      console.error('Failed to load ride history:', err);
      setError('Could not load your ride history. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      fetchRideHistory();
    }
  }, [isLoaded, isSignedIn]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col text-neutral-900 font-sans">
      <Navbar activeTab="Activity" />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-200">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-black">Past Activity</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Review your completed journeys, driver ratings, and payment receipts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchRideHistory}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-neutral-700 bg-white border border-neutral-200 rounded-full hover:bg-neutral-100 transition shadow-sm"
              title="Refresh History"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <Link
              href="/"
              className="px-4 py-2 text-xs font-bold text-white bg-black rounded-full hover:bg-neutral-800 transition shadow-sm"
            >
              Book a Ride
            </Link>
          </div>
        </div>

        {/* Auth Required State */}
        {!isSignedIn && isLoaded ? (
          <div className="bg-white rounded-3xl border border-neutral-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-neutral-100 text-black rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Car size={32} />
            </div>
            <h2 className="text-xl font-bold text-black mb-2">Sign in to view your activity</h2>
            <p className="text-sm text-neutral-500 max-w-md mx-auto mb-6">
              Log in with your Clerk account to see your real-time ride history, fare receipts, and driver feedback.
            </p>
            <SignInButton mode="modal">
              <button className="px-6 py-3 bg-black text-white font-bold text-sm rounded-full hover:bg-neutral-800 transition shadow-md">
                Log In as Rider
              </button>
            </SignInButton>
          </div>
        ) : loading ? (
          /* Loading Skeletons */
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-neutral-200 animate-pulse flex flex-col gap-4">
                <div className="h-4 bg-neutral-200 rounded w-1/4" />
                <div className="h-6 bg-neutral-100 rounded w-3/4" />
                <div className="h-4 bg-neutral-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700">
            <AlertCircle size={24} className="mx-auto mb-2 text-red-500" />
            <p className="font-semibold">{error}</p>
            <button
              onClick={fetchRideHistory}
              className="mt-3 px-4 py-1.5 bg-red-600 text-white rounded-full text-xs font-bold hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        ) : rides.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-3xl border border-neutral-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-neutral-100 text-neutral-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Receipt size={30} />
            </div>
            <h3 className="text-lg font-bold text-black mb-1">No trips yet</h3>
            <p className="text-sm text-neutral-500 max-w-sm mx-auto mb-6">
              When you take a ride, your route details, receipts, and driver ratings will appear here.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white text-sm font-bold rounded-full hover:bg-neutral-800 transition shadow-md"
            >
              Request your first ride <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          /* Ride List */
          <div className="space-y-4">
            {rides.map((ride) => {
              // Extract review if present
              const reviewObj = Array.isArray(ride.reviews)
                ? ride.reviews[0]
                : ride.reviews;
              const rating = reviewObj?.rating;
              const feedback = reviewObj?.feedback;
              const driverName = ride.driver?.user?.full_name || 'Driver Partner';
              const vehicleInfo = ride.driver?.vehicle_model
                ? `${ride.driver?.vehicle_color || ''} ${ride.driver?.vehicle_model} • ${ride.driver?.vehicle_plate || ''}`
                : 'Uber Verified Vehicle';

              return (
                <div
                  key={ride.id}
                  className="bg-white rounded-2xl border border-neutral-200 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-xl flex-shrink-0">
                        {ride.ride_tier === 'UberXL' ? '🚐' : ride.ride_tier === 'UberPremier' ? '🚙' : '🚗'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-base text-black">{ride.ride_tier}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 font-semibold uppercase tracking-wider">
                            {ride.status}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                          <Calendar size={12} />
                          <span>{formatDate(ride.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-left md:text-right">
                      <div className="text-xl font-black text-black">
                        ₹{Number(ride.fare_amount || 0).toFixed(2)}
                      </div>
                      <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                        💵 Cash on Delivery
                      </div>
                    </div>
                  </div>

                  {/* Route Visualizer */}
                  <div className="py-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0 shadow-sm" />
                      <div>
                        <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Pickup</div>
                        <div className="text-sm font-medium text-black line-clamp-1">{ride.pickup_address}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-2.5 h-2.5 rounded-sm bg-black mt-1 flex-shrink-0" />
                      <div>
                        <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Dropoff</div>
                        <div className="text-sm font-medium text-black line-clamp-1">{ride.dropoff_address}</div>
                      </div>
                    </div>
                  </div>

                  {/* Driver and Rating Footer */}
                  <div className="pt-3 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/50 -mx-5 -mb-5 md:-mx-6 md:-mb-6 p-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">
                        {driverName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-black">{driverName}</div>
                        <div className="text-[11px] text-neutral-500">{vehicleInfo}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Rating Given */}
                      {rating ? (
                        <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-bold text-amber-800">
                          <Star size={13} className="fill-amber-400 text-amber-400" />
                          <span>{rating}.0 Given</span>
                          {feedback && <span className="font-normal text-amber-700 ml-1">· &quot;{feedback}&quot;</span>}
                        </div>
                      ) : (
                        <div className="text-xs text-neutral-400 italic">
                          No star rating submitted
                        </div>
                      )}

                      <button
                        onClick={() => setSelectedRide(ride)}
                        className="text-xs font-bold text-neutral-700 hover:text-black flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        Receipt <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Receipt Modal */}
      {selectedRide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Receipt size={20} className="text-black" />
                <h3 className="font-bold text-lg text-black">Official Trip Receipt</h3>
              </div>
              <button
                onClick={() => setSelectedRide(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-black font-bold"
              >
                ✕
              </button>
            </div>

            <div className="py-6 space-y-4">
              <div className="text-center pb-4 border-b border-neutral-100">
                <div className="text-3xl font-black text-black">
                  ₹{Number(selectedRide.fare_amount || 0).toFixed(2)}
                </div>
                <div className="text-xs text-neutral-500 mt-1">Paid in Cash on Delivery</div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-neutral-500">
                  <span>Trip ID</span>
                  <span className="font-mono text-black font-medium">{selectedRide.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>Date & Time</span>
                  <span className="text-black font-medium">{formatDate(selectedRide.created_at)}</span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>Vehicle Tier</span>
                  <span className="text-black font-medium">{selectedRide.ride_tier}</span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>Driver</span>
                  <span className="text-black font-medium">{selectedRide.driver?.user?.full_name || 'Driver Partner'}</span>
                </div>
                {selectedRide.otp && (
                  <div className="flex justify-between text-neutral-500">
                    <span>Trip OTP</span>
                    <span className="font-mono font-bold text-black">{selectedRide.otp}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl space-y-2 text-xs">
                <div>
                  <span className="font-bold text-neutral-600">Pickup: </span>
                  <span className="text-neutral-800">{selectedRide.pickup_address}</span>
                </div>
                <div>
                  <span className="font-bold text-neutral-600">Dropoff: </span>
                  <span className="text-neutral-800">{selectedRide.dropoff_address}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedRide(null)}
              className="w-full py-3 bg-black text-white rounded-xl font-bold text-sm hover:bg-neutral-800 transition"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
