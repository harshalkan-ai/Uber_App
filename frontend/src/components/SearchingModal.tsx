'use client';

interface SearchingModalProps {
  onCancel: () => void;
  pickupAddress: string;
  dropoffAddress: string;
  tier: string;
}

export default function SearchingModal({
  onCancel,
  pickupAddress,
  dropoffAddress,
  tier,
}: SearchingModalProps) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Finding your driver"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fadeIn" />

      {/* Card */}
      <div className="relative bg-white rounded-3xl w-full max-w-[380px] p-8 shadow-2xl animate-fadeInUp text-center">
        {/* Radar Animation */}
        <div className="relative flex items-center justify-center mb-6 mt-2">
          {/* Ripple rings */}
          <div
            className="absolute w-28 h-28 rounded-full border-2 border-black animate-radar"
            style={{ animationDelay: '0s' }}
          />
          <div
            className="absolute w-28 h-28 rounded-full border-2 border-black animate-radar"
            style={{ animationDelay: '0.6s' }}
          />
          <div
            className="absolute w-28 h-28 rounded-full border-2 border-black animate-radar"
            style={{ animationDelay: '1.2s' }}
          />
          {/* Car icon center */}
          <div className="relative z-10 w-16 h-16 bg-black rounded-full flex items-center justify-center shadow-lg">
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <path d="M8 24L9.5 17H26.5L28 24H8Z" fill="white" />
              <path d="M9.5 17L11 11H25L26.5 17" fill="white" />
              <circle cx="12" cy="25" r="2.5" fill="#888" />
              <circle cx="24" cy="25" r="2.5" fill="#888" />
              <rect x="13" y="12.5" width="10" height="3" rx="0.5" fill="#87CEEB" opacity="0.8" />
            </svg>
          </div>
        </div>

        <h3 className="text-xl font-bold text-black mb-2">Finding your driver</h3>
        <p className="text-sm text-neutral-500 mb-1">
          <span className="font-medium text-black">{tier}</span> ·{' '}
          {pickupAddress.split(',')[0]}
        </p>
        <p className="text-xs text-neutral-400 mb-7">→ {dropoffAddress.split(',')[0]}</p>

        {/* Animated dots */}
        <div className="flex items-center justify-center gap-2 mb-7">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-black rounded-full"
              style={{
                animation: 'pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>

        <button
          id="btn-cancel-search"
          onClick={onCancel}
          className="w-full py-3.5 border-2 border-neutral-200 rounded-xl text-sm font-semibold text-black hover:border-neutral-400 hover:bg-neutral-50 transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
