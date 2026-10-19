'use client';

import { useState } from 'react';
import { ShieldAlert, Phone, Share2, AlertTriangle, Check, X, MapPin } from 'lucide-react';

interface SosModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAddress?: string;
  driverName?: string;
  vehiclePlate?: string;
}

export default function SosModal({
  isOpen,
  onClose,
  currentAddress = 'Marine Drive, Mumbai, Maharashtra',
  driverName = 'Rajesh Sharma',
  vehiclePlate = 'MH 02 AB 1234',
}: SosModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleShareTrip = () => {
    const shareText = `Emergency SOS Alert: I am currently riding in an Uber (${vehiclePlate}, Driver: ${driverName}). My current location is ${currentAddress}.`;
    if (navigator.share) {
      navigator.share({
        title: 'Uber Emergency Ride Alert',
        text: shareText,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 text-black border-2 border-red-500 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <div className="flex items-center gap-2 text-red-600">
            <ShieldAlert size={24} className="animate-pulse" />
            <span className="text-xl font-black tracking-tight text-red-600">Emergency SOS</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-black"
          >
            <X size={16} />
          </button>
        </div>

        {/* Warning banner */}
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
          If you feel unsafe or in danger, contact emergency services immediately. Your trip details and live GPS are ready to share.
        </div>

        {/* Trip snapshot */}
        <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-100 space-y-1 text-xs">
          <div className="flex items-center gap-1.5 text-neutral-500 font-medium">
            <MapPin size={13} className="text-red-500 flex-shrink-0" />
            <span className="truncate text-black font-semibold">{currentAddress}</span>
          </div>
          <div className="text-neutral-600 pt-1 border-t border-neutral-200 flex justify-between">
            <span>Driver: <strong className="text-black">{driverName}</strong></span>
            <span>Vehicle: <strong className="text-black">{vehiclePlate}</strong></span>
          </div>
        </div>

        {/* Emergency Call Options */}
        <div className="space-y-2">
          <a
            href="tel:112"
            className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <Phone size={16} /> Call Emergency Helpline (112)
          </a>

          <a
            href="tel:100"
            className="w-full py-3 bg-neutral-900 hover:bg-black text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all"
          >
            <Phone size={14} /> Call Police Control (100)
          </a>

          <button
            onClick={handleShareTrip}
            className="w-full py-3 border border-neutral-300 hover:bg-neutral-50 text-black rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-600" />
                <span className="text-emerald-600 font-bold">Trip Details Copied!</span>
              </>
            ) : (
              <>
                <Share2 size={14} /> Share Live Trip Details with Emergency Contact
              </>
            )}
          </button>
        </div>

        {/* Dismiss */}
        <button
          onClick={onClose}
          className="text-xs text-neutral-400 hover:text-neutral-700 font-semibold py-1 transition-colors text-center"
        >
          I am safe, close this window
        </button>
      </div>
    </div>
  );
}
