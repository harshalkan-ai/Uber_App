'use client';

import { X } from 'lucide-react';

interface RentalsModalProps {
  onClose: () => void;
}

export default function RentalsModal({ onClose }: RentalsModalProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Uber Rentals"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-3xl overflow-hidden w-full max-w-[340px] shadow-2xl animate-fadeInUp">
        {/* Close Button */}
        <button
          id="btn-close-rentals"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-white/80 rounded-full hover:bg-white transition-colors"
          aria-label="Close"
        >
          <X size={16} className="text-neutral-600" />
        </button>

        {/* Illustration Header */}
        <div
          className="h-52 flex items-end justify-center pb-4 relative overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #dde8f8 0%, #c5d8f5 50%, #e8eef8 100%)',
          }}
        >
          {/* City skyline silhouette */}
          <svg
            viewBox="0 0 340 100"
            className="absolute bottom-0 left-0 right-0 w-full"
            fill="none"
          >
            <rect x="10" y="40" width="30" height="60" rx="2" fill="#b8cfe8" opacity="0.6" />
            <rect x="20" y="25" width="10" height="20" rx="1" fill="#b8cfe8" opacity="0.6" />
            <rect x="50" y="20" width="40" height="80" rx="2" fill="#9db8db" opacity="0.7" />
            <rect x="60" y="10" width="20" height="15" rx="1" fill="#9db8db" opacity="0.7" />
            <rect x="100" y="50" width="25" height="50" rx="2" fill="#b8cfe8" opacity="0.5" />
            <rect x="130" y="30" width="50" height="70" rx="2" fill="#8aadd4" opacity="0.7" />
            <rect x="145" y="18" width="20" height="18" rx="1" fill="#8aadd4" opacity="0.7" />
            <rect x="190" y="45" width="30" height="55" rx="2" fill="#b8cfe8" opacity="0.6" />
            <rect x="230" y="25" width="45" height="75" rx="2" fill="#9db8db" opacity="0.65" />
            <rect x="240" y="12" width="25" height="18" rx="1" fill="#9db8db" opacity="0.65" />
            <rect x="285" y="38" width="35" height="62" rx="2" fill="#b0c9e5" opacity="0.6" />
          </svg>

          {/* Car illustration */}
          <div className="relative z-10 animate-car">
            <svg width="140" height="80" viewBox="0 0 140 80" fill="none">
              {/* Car body */}
              <rect x="10" y="35" width="120" height="35" rx="8" fill="#f0f0f0" />
              {/* Car roof */}
              <path d="M30 35 L45 15 H95 L110 35 Z" fill="white" />
              {/* Windows */}
              <path d="M48 18 L43 33 H68 V18 Z" fill="#87CEEB" opacity="0.7" rx="2"/>
              <path d="M72 18 H97 L92 33 H72 Z" fill="#87CEEB" opacity="0.7" rx="2"/>
              {/* Person */}
              <circle cx="90" cy="8" r="7" fill="#c4a882" />
              <path d="M75 35 Q90 10 105 20" stroke="#6b7cba" strokeWidth="10" strokeLinecap="round" fill="none" />
              {/* Wheels */}
              <circle cx="35" cy="68" r="12" fill="#333" />
              <circle cx="35" cy="68" r="6" fill="#888" />
              <circle cx="105" cy="68" r="12" fill="#333" />
              <circle cx="105" cy="68" r="6" fill="#888" />
              {/* Headlights */}
              <rect x="120" y="42" width="12" height="6" rx="3" fill="#fffde7" />
              {/* Taillights */}
              <rect x="8" y="42" width="10" height="6" rx="3" fill="#ffcdd2" />
              {/* License plate */}
              <rect x="55" y="68" width="30" height="8" rx="2" fill="#ddd" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h2 className="text-2xl font-black text-black mb-5">Uber Rentals</h2>

          {/* Feature List */}
          <div className="space-y-4 mb-7">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                {/* Hourglass icon */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 00-.586-1.414L12 12l-4.414 4.414A2 2 0 007 17.828V22M7 2v4.172a2 2 0 00.586 1.414L12 12l4.414-4.414A2 2 0 0017 6.172V2"/>
                </svg>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Keep a car and driver for up to 12 hours
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                {/* Briefcase icon */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
                  <line x1="12" y1="12" x2="12" y2="12" strokeWidth="3"/>
                  <path d="M2 12h20"/>
                </svg>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Ideal for business meetings, tourist travel and multiple stop trips
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                {/* Car clock icon */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Book for now or reserve for later
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <button
            id="btn-rentals-get-started"
            className="w-full bg-black text-white font-bold py-4 rounded-2xl hover:bg-neutral-800 active:scale-[0.98] transition-all text-sm"
          >
            Get started
          </button>
        </div>
      </div>
    </div>
  );
}
