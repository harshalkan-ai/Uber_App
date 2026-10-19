'use client';

import { useState, useEffect } from 'react';
import { Phone, MessageCircle, Star, X, Navigation, Clock, ShieldCheck } from 'lucide-react';

interface DriverInfo {
  name: string;
  phone?: string;
  vehicle_model: string;
  vehicle_plate: string;
  vehicle_color: string;
  rating: number;
  profile_image_url?: string;
}

interface ActiveRideCardProps {
  driver: DriverInfo;
  status: string; // 'accepted' | 'assigned' | 'arrived' | 'in_progress' | 'completed'
  pickupAddress: string;
  dropoffAddress: string;
  fareAmount: number;
  tier: string;
  otp?: string;
  initialEtaMinutes?: number;
  onCancel: () => void;
  onSos?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; etaPrefix: string }> = {
  accepted: {
    label: 'Driver Assigned & En Route',
    badge: 'bg-blue-600 text-white',
    etaPrefix: 'Driver arriving in',
  },
  assigned: {
    label: 'Driver Assigned & En Route',
    badge: 'bg-blue-600 text-white',
    etaPrefix: 'Driver arriving in',
  },
  arrived: {
    label: 'Driver Arrived at Pickup Point',
    badge: 'bg-amber-500 text-black',
    etaPrefix: 'Waiting for passenger',
  },
  in_progress: {
    label: 'Trip in Progress',
    badge: 'bg-emerald-600 text-white',
    etaPrefix: 'Reaching destination in',
  },
  completed: {
    label: 'Trip Completed',
    badge: 'bg-black text-white',
    etaPrefix: 'Trip ended',
  },
};

export default function ActiveRideCard({
  driver,
  status,
  pickupAddress,
  dropoffAddress,
  fareAmount,
  tier,
  otp = '4821',
  initialEtaMinutes = 3,
  onCancel,
  onSos,
}: ActiveRideCardProps) {
  const [etaSeconds, setEtaSeconds] = useState<number>(initialEtaMinutes * 60);

  // Dynamic ETA live countdown
  useEffect(() => {
    if (status === 'completed' || status === 'arrived') return;
    const interval = setInterval(() => {
      setEtaSeconds((prev) => (prev > 15 ? prev - 1 : 15));
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const etaMinutes = Math.ceil(etaSeconds / 60);
  const statusInfo = STATUS_CONFIG[status] || STATUS_CONFIG.assigned;

  return (
    <div
      className="bg-white rounded-3xl w-full max-w-[420px] animate-fadeInUp overflow-hidden flex flex-col gap-0 border border-neutral-200"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
    >
      {/* Dynamic ETA Header Banner */}
      <div className="bg-black text-white p-5 flex items-center justify-between">
        <div>
          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${statusInfo.badge}`}>
            {statusInfo.label}
          </span>
          <div className="text-xl font-black mt-1 flex items-center gap-2">
            <Clock size={18} className="text-amber-400" />
            {status === 'arrived' ? (
              <span>Driver is waiting outside!</span>
            ) : status === 'in_progress' ? (
              <span>On the way to destination</span>
            ) : (
              <span>{statusInfo.etaPrefix} {etaMinutes} min{etaMinutes !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        {onSos && (
          <button
            id="btn-trigger-sos"
            type="button"
            onClick={onSos}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-full transition-all shadow-md flex items-center gap-1 cursor-pointer"
            title="Emergency SOS"
          >
            🚨 SOS
          </button>
        )}
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Prominent Safety PIN Card */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 text-center shadow-sm">
          <div className="flex items-center justify-center gap-1.5 text-amber-900 font-bold text-xs uppercase tracking-wider mb-2">
            <ShieldCheck size={16} className="text-amber-600" />
            <span>Share this OTP with driver:</span>
          </div>
          <div className="flex items-center justify-center gap-2.5">
            {otp.split('').map((digit, i) => (
              <span
                key={i}
                className="w-12 h-14 bg-white border-2 border-amber-400 rounded-2xl flex items-center justify-center text-3xl font-black text-black shadow-md tracking-tight"
              >
                {digit}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-amber-800 mt-2 font-medium">
            Driver cannot start trip without entering this 4-digit safety code.
          </p>
        </div>

        {/* Assigned Driver Details Card */}
        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-center gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-black text-white flex-shrink-0 flex items-center justify-center text-xl font-bold shadow-sm">
            {driver.profile_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={driver.profile_image_url} alt={driver.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              driver.name.charAt(0).toUpperCase()
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-black text-base truncate">{driver.name}</div>
            <div className="text-xs text-neutral-600 font-medium">
              {driver.vehicle_color} {driver.vehicle_model}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs font-bold text-black bg-neutral-200 px-2 py-0.5 rounded-md tracking-wider">
                {driver.vehicle_plate}
              </span>
              <div className="flex items-center gap-0.5 text-xs font-bold text-amber-600">
                <Star size={12} className="fill-amber-400 text-amber-400" />
                <span>{driver.rating ? Number(driver.rating).toFixed(1) : '4.9'}</span>
              </div>
            </div>
          </div>

          {/* Call / Action */}
          <div className="flex gap-2 flex-shrink-0">
            {driver.phone && (
              <a
                href={`tel:${driver.phone}`}
                className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-neutral-800 transition shadow-sm"
                title="Call Driver"
              >
                <Phone size={16} />
              </a>
            )}
          </div>
        </div>

        {/* Route Details */}
        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
            <span className="text-neutral-700 truncate font-medium">From: {pickupAddress}</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-sm bg-black mt-1 flex-shrink-0" />
            <span className="text-neutral-700 truncate font-medium">To: {dropoffAddress}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-neutral-200 text-neutral-900 font-bold">
            <span>Fare: ₹{fareAmount.toFixed(2)}</span>
            <span className="text-emerald-700 font-semibold">💵 Cash on Delivery</span>
          </div>
        </div>

        {/* Cancel Button */}
        {status !== 'in_progress' && status !== 'completed' && (
          <button
            id="btn-cancel-ride"
            onClick={onCancel}
            className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white font-bold text-sm rounded-2xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <X size={16} />
            Cancel Ride
          </button>
        )}
      </div>
    </div>
  );
}
