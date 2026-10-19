'use client';

import { Phone, MessageCircle, Star, X, Navigation } from 'lucide-react';

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
  status: string; // 'assigned' | 'arrived' | 'in_progress' | 'completed'
  pickupAddress: string;
  dropoffAddress: string;
  fareAmount: number;
  tier: string;
  onCancel: () => void;
  onSos?: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  accepted: { label: '🚗 Driver is on the way', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  assigned: { label: '🚗 Driver is on the way', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  arrived: { label: '📍 Driver has arrived at pickup', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_progress: { label: '🏎️ Ride in progress', color: 'bg-green-50 text-green-700 border-green-200' },
  completed: { label: '✅ Ride completed', color: 'bg-neutral-50 text-neutral-700 border-neutral-200' },
};

export default function ActiveRideCard({
  driver,
  status,
  pickupAddress,
  dropoffAddress,
  fareAmount,
  tier,
  onCancel,
  onSos,
}: ActiveRideCardProps) {
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.assigned;

  return (
    <div
      className="bg-white rounded-2xl w-full max-w-[420px] animate-fadeInUp overflow-hidden"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.07)' }}
    >
      {/* Status Banner */}
      <div className={`px-5 py-3 border ${statusInfo.color} text-sm font-semibold text-center flex items-center justify-between`}>
        <span className="flex-1 text-center">{statusInfo.label}</span>
        {onSos && (
          <button
            id="btn-trigger-sos"
            type="button"
            onClick={onSos}
            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-black rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
            title="Emergency SOS"
          >
            🚨 SOS
          </button>
        )}
      </div>

      {/* Driver Info */}
      <div className="px-6 py-5 border-b border-neutral-100">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full overflow-hidden bg-neutral-200 flex-shrink-0 flex items-center justify-center">
            {driver.profile_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={driver.profile_image_url} alt={driver.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-neutral-500">
                {driver.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Driver details */}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-black text-base">{driver.name}</div>
            <div className="flex items-center gap-1 text-sm text-neutral-500 mt-0.5">
              <Star size={13} fill="#f59e0b" className="text-amber-400" />
              <span className="font-semibold text-black">{driver.rating?.toFixed(1)}</span>
              <span className="mx-1">·</span>
              <span>{tier}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-shrink-0">
            {driver.phone && (
              <a
                href={`tel:${driver.phone}`}
                className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-all"
                title="Call driver"
              >
                <Phone size={16} className="text-neutral-600" />
              </a>
            )}
            <button
              id="btn-message-driver"
              className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-all"
              title="Message driver"
            >
              <MessageCircle size={16} className="text-neutral-600" />
            </button>
          </div>
        </div>

        {/* Vehicle info */}
        <div className="mt-4 p-3 bg-neutral-50 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-neutral-500">Vehicle</div>
            <div className="text-sm font-semibold text-black capitalize">
              {driver.vehicle_color} {driver.vehicle_model}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-500">Plate</div>
            <div className="text-sm font-bold text-black tracking-wider">
              {driver.vehicle_plate}
            </div>
          </div>
        </div>
      </div>

      {/* Trip Summary */}
      <div className="px-6 py-4 border-b border-neutral-100">
        <div className="flex items-start gap-3 mb-3">
          <Navigation size={14} className="text-black mt-0.5 flex-shrink-0" fill="black" />
          <div>
            <div className="text-xs text-neutral-500 mb-0.5">From</div>
            <div className="text-sm text-black font-medium truncate">
              {pickupAddress.split(',').slice(0, 2).join(',')}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-3.5 h-3.5 bg-black rounded-sm mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs text-neutral-500 mb-0.5">To</div>
            <div className="text-sm text-black font-medium truncate">
              {dropoffAddress.split(',').slice(0, 2).join(',')}
            </div>
          </div>
        </div>
      </div>

      {/* Fare & Cancel */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-neutral-500">Estimated fare</div>
          <div className="text-lg font-bold text-black">₹{fareAmount.toFixed(2)}</div>
        </div>
        {status !== 'in_progress' && status !== 'completed' && (
          <button
            id="btn-cancel-ride"
            onClick={onCancel}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-all"
          >
            <X size={14} />
            Cancel ride
          </button>
        )}
      </div>
    </div>
  );
}
