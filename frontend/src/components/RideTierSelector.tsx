'use client';

import { useState } from 'react';
import { useUser, SignInButton } from '@clerk/nextjs';
import { CheckCircle, CreditCard, ChevronDown, ArrowLeft } from 'lucide-react';
import axios from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FareEstimate {
  tier: string;
  price: number;
  originalPrice: number;
  durationMinutes: number;
  distanceKm: number;
}

interface RideData {
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
}

interface RideTierSelectorProps {
  estimates: FareEstimate[];
  rideData: RideData;
  getAuthToken: () => Promise<string | null>;
  onRideBooked: (ride: BookedRide) => void;
  onBack?: () => void;
  isMobile?: boolean;
}

export interface BookedRide {
  id: string;
  status: string;
  fare_amount: number;
  ride_tier: string;
  pickup_address: string;
  dropoff_address: string;
  otp?: string;
}

// ─── Tier Metadata ─────────────────────────────────────────────────────────
const TIER_META: Record<
  string,
  { emoji: string; tagline: string; badge?: { label: string; color: string } }
> = {
  UberGo: {
    emoji: '🚗',
    tagline: 'Affordable compact ride',
    badge: { label: 'Affordable', color: 'bg-green-100 text-green-700' },
  },
  UberPremier: {
    emoji: '🚙',
    tagline: 'Comfortable sedan',
    badge: { label: 'Top rated', color: 'bg-purple-100 text-purple-700' },
  },
  UberXL: {
    emoji: '🚐',
    tagline: '6-seater SUV',
    badge: { label: 'Extra seats', color: 'bg-blue-100 text-blue-700' },
  },
  UberAuto: {
    emoji: '🛺',
    tagline: 'Affordable auto-rickshaw',
  },
  UberBike: {
    emoji: '🏍️',
    tagline: 'Beat traffic on a bike',
  },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export default function RideTierSelector({
  estimates,
  rideData,
  getAuthToken,
  onRideBooked,
  onBack,
  isMobile = false,
}: RideTierSelectorProps) {
  const { isSignedIn } = useUser();
  const [selectedTier, setSelectedTier] = useState<string>(
    estimates[0]?.tier || 'UberGo'
  );
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Cash');
  const [showPaymentMenu, setShowPaymentMenu] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);

  // Promo code & discounts
  const [promoInput, setPromoInput] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountFlat, setDiscountFlat] = useState<number>(0);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [driverNote, setDriverNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (code === 'UBER50') {
      setDiscountPercent(50);
      setDiscountFlat(0);
      setPromoMessage('50% discount applied! (Max ₹100)');
    } else if (code === 'UBERINDIA' || code === 'WELCOME') {
      setDiscountFlat(50);
      setDiscountPercent(0);
      setPromoMessage('₹50 instant discount applied!');
    } else {
      setPromoMessage('Invalid promo code. Try "UBERINDIA" or "UBER50".');
    }
  };

  const selectedEstimate = estimates.find((e) => e.tier === selectedTier);

  const calculateFinalPrice = (basePrice: number) => {
    let price = basePrice;
    if (discountPercent > 0) {
      const discount = Math.min((basePrice * discountPercent) / 100, 100);
      price -= discount;
    }
    if (discountFlat > 0) {
      price = Math.max(price - discountFlat, 25);
    }
    return Math.max(price, 25);
  };

  const handleBook = async () => {
    if (!selectedEstimate) return;
    setBookingError(null);
    setIsBooking(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setBookingError('Please log in to confirm your ride.');
        setIsBooking(false);
        return;
      }

      let activePayment = paymentMethod;

      // 1. If Card was selected, test intent or handle fallback
      if (activePayment === 'Card') {
        try {
          const intentRes = await axios.post<{ success: boolean; data: { clientSecret: string } }>(
            `${API_URL}/payments/create-intent`,
            { rideId: 'test-ride-preview' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (intentRes.data?.data?.clientSecret) {
            setStripeClientSecret(intentRes.data.data.clientSecret);
          }
        } catch {
          // As explicitly requested: Fall back to Cash on Delivery if payment API is not working
          console.warn('[Payment] Stripe card intent unavailable, falling back to Cash on Delivery');
          activePayment = 'Cash';
          setPaymentMethod('Cash');
        }
      }

      // 2. Create booking in backend
      const { data } = await axios.post<{ success: boolean; data: BookedRide }>(
        `${API_URL}/rides/book`,
        {
          pickup_address: rideData.pickupAddress,
          pickup_lat: rideData.pickupLat,
          pickup_lng: rideData.pickupLng,
          dropoff_address: rideData.dropoffAddress,
          dropoff_lat: rideData.dropoffLat,
          dropoff_lng: rideData.dropoffLng,
          ride_tier: selectedTier,
          payment_method: activePayment === 'Card' ? 'Card' : 'Cash on Delivery',
          notes: driverNote.trim() || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const ride = data.data;
      onRideBooked(ride);
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message || 'Booking failed. Please try again.'
        : 'Something went wrong.';
      setBookingError(message);
    } finally {
      setIsBooking(false);
    }
  };

  const arrivalTime = (minutes: number) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    return now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div
      className={`flex flex-col bg-white rounded-2xl w-full animate-fadeInUp ${
        isMobile ? 'border-0 shadow-none p-0' : 'p-5 shadow-2xl border border-neutral-200'
      }`}
    >
      {/* Mobile Top Drag Handle */}
      <div className="w-12 h-1.5 bg-neutral-300 rounded-full mx-auto mb-3 md:hidden" />

      {/* Header */}
      <div className="pb-3 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-neutral-100 transition-colors text-black"
              aria-label="Back to search"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold text-black tracking-tight">Choose a ride</h2>
            <p className="text-xs text-neutral-500">Rides we think you&apos;ll like</p>
          </div>
        </div>
      </div>

      {/* Tier List */}
      <div className="divide-y divide-neutral-100 max-h-60 overflow-y-auto">
        {estimates.map((estimate) => {
          const meta = TIER_META[estimate.tier] || { emoji: '🚗', tagline: '' };
          const isSelected = selectedTier === estimate.tier;
          const arrival = arrivalTime(estimate.durationMinutes);

          return (
            <button
              key={estimate.tier}
              type="button"
              id={`tier-${estimate.tier.toLowerCase()}`}
              onClick={() => setSelectedTier(estimate.tier)}
              className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-left transition-all my-1 ${
                isSelected
                  ? 'bg-neutral-50 border-2 border-black'
                  : 'hover:bg-neutral-50 border-2 border-transparent'
              }`}
            >
              {/* Vehicle Emoji */}
              <div className="text-3xl w-10 flex-shrink-0 text-center">{meta.emoji}</div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-black text-sm">{estimate.tier}</span>
                  {meta.badge && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.badge.color}`}>
                      {meta.badge.label}
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500">
                  {arrival} · {estimate.durationMinutes} min
                </div>
                <div className="text-xs text-neutral-400 mt-0.5 truncate">{meta.tagline}</div>
              </div>

              {/* Price */}
              <div className="text-right flex-shrink-0">
                <div className="font-bold text-black text-sm">
                  ₹{calculateFinalPrice(estimate.price).toFixed(2)}
                </div>
                {(estimate.originalPrice > estimate.price || discountPercent > 0 || discountFlat > 0) && (
                  <div className="text-[11px] text-neutral-400 line-through">
                    ₹{estimate.originalPrice.toFixed(2)}
                  </div>
                )}
              </div>

              {/* Selected checkmark */}
              {isSelected && (
                <CheckCircle size={18} className="text-black flex-shrink-0" fill="black" />
              )}
            </button>
          );
        })}
      </div>

      {/* Promo Code & Driver Notes Bar */}
      <div className="pt-2 flex flex-col gap-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 rounded-xl border border-neutral-200">
          <input
            type="text"
            placeholder="Promo code (e.g. UBER50, UBERINDIA)"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
            className="flex-1 bg-transparent text-xs font-semibold text-black uppercase focus:outline-none placeholder:normal-case placeholder:font-normal placeholder:text-neutral-400"
          />
          <button
            type="button"
            id="btn-apply-promo"
            onClick={handleApplyPromo}
            className="px-2.5 py-1 bg-black hover:bg-neutral-800 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
          >
            Apply
          </button>
        </div>

        {promoMessage && (
          <div
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
              discountPercent > 0 || discountFlat > 0
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {promoMessage}
          </div>
        )}

        {/* Optional Driver Note */}
        {showNoteInput ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 rounded-xl border border-neutral-200 animate-fadeIn">
            <input
              type="text"
              placeholder="Note for driver (e.g. Gate 2, near ATM)"
              value={driverNote}
              onChange={(e) => setDriverNote(e.target.value)}
              className="flex-1 bg-transparent text-xs text-black focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowNoteInput(false)}
              className="text-[11px] text-neutral-400 hover:text-black font-bold"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNoteInput(true)}
            className="text-[11px] text-neutral-500 hover:text-black font-medium text-left px-1 flex items-center gap-1"
          >
            + Add pickup note for driver
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-neutral-100 flex flex-col gap-2.5">
        {bookingError && (
          <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-700 animate-fadeIn">
            {bookingError}
          </div>
        )}

        {/* Pure Cash Payment Pill */}
        <div className="flex items-center justify-between p-3 bg-neutral-100 rounded-xl text-xs font-semibold text-black border border-neutral-200">
          <div className="flex items-center gap-2">
            <span className="text-base">💵</span>
            <div>
              <span className="font-bold">Cash on Delivery</span>
              <p className="text-[11px] text-neutral-500 font-normal">Pay driver directly after ride</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            No Card Needed
          </span>
        </div>

        {/* Confirm Button */}
        {!isSignedIn ? (
          <SignInButton mode="modal">
            <button
              type="button"
              id="btn-confirm-ride-login"
              className="w-full py-4 rounded-xl font-bold text-sm bg-black text-white hover:bg-neutral-800 transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              Log in to Confirm {selectedTier} (Cash)
            </button>
          </SignInButton>
        ) : (
          <button
            type="button"
            id="btn-confirm-ride"
            onClick={handleBook}
            disabled={isBooking || !selectedEstimate}
            className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${
              isBooking || !selectedEstimate
                ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                : 'bg-black text-white hover:bg-neutral-800 active:scale-[0.98] cursor-pointer'
            }`}
          >
            {isBooking ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Requesting {selectedTier}…
              </>
            ) : (
              `Confirm Ride (Cash) • ₹${selectedEstimate ? calculateFinalPrice(selectedEstimate.price).toFixed(2) : ''}`
            )}
          </button>
        )}
      </div>

      {/* Stripe Card Checkout Modal */}
      {showCardModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-black mb-1">Stripe Payment</h3>
            <p className="text-xs text-neutral-500 mb-4">
              Pay ₹{selectedEstimate?.price.toFixed(2)} securely via Stripe
            </p>
            <div className="border border-neutral-200 rounded-xl p-3 bg-neutral-50 mb-4 text-xs text-neutral-600">
              <div className="flex items-center gap-2 mb-2 font-medium text-black">
                <CreditCard size={15} /> Card Payment
              </div>
              <p className="text-[11px] text-neutral-400">
                Payment Intent ID: {stripeClientSecret ? stripeClientSecret.slice(0, 24) + '...' : 'Generated'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCardModal(false)}
              className="w-full py-3 bg-black text-white rounded-xl font-semibold text-sm hover:bg-neutral-800 transition-all"
            >
              Authorize & Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
