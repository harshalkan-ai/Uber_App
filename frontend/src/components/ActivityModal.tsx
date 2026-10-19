'use client';

import { useState, useEffect } from 'react';
import { X, Receipt, MapPin, Calendar, Clock, CreditCard, Download, Printer, CheckCircle, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '@clerk/nextjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export interface TripHistoryItem {
  id: string;
  created_at: string;
  pickup_address: string;
  dropoff_address: string;
  fare_amount: number;
  ride_tier: string;
  status: string;
  payment_method?: string;
  driver_name?: string;
  distance_km?: number;
}

const DEFAULT_MOCK_HISTORY: TripHistoryItem[] = [
  {
    id: 'ubr-trip-98412',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    pickup_address: 'Bandra Kurla Complex (BKC), Mumbai',
    dropoff_address: 'Chhatrapati Shivaji Maharaj Airport (BOM), T2',
    fare_amount: 245.5,
    ride_tier: 'UberGo',
    status: 'completed',
    payment_method: 'Cash on Delivery',
    driver_name: 'Amitabh Sen',
    distance_km: 7.8,
  },
  {
    id: 'ubr-trip-87321',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    pickup_address: 'Marine Drive, Nariman Point, Mumbai',
    dropoff_address: 'Colaba Causeway, Mumbai',
    fare_amount: 120.0,
    ride_tier: 'UberPremier',
    status: 'completed',
    payment_method: 'Card (Stripe)',
    driver_name: 'Vikram Singh',
    distance_km: 3.4,
  },
  {
    id: 'ubr-trip-76210',
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
    pickup_address: 'Andheri West Metro Station, Mumbai',
    dropoff_address: 'Juhu Beach, Mumbai',
    fare_amount: 140.0,
    ride_tier: 'UberGo',
    status: 'completed',
    payment_method: 'Cash on Delivery',
    driver_name: 'Amit Verma',
    distance_km: 4.1,
  },
];

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ActivityModal({ isOpen, onClose }: ActivityModalProps) {
  const { getToken, isSignedIn } = useAuth();
  const [trips, setTrips] = useState<TripHistoryItem[]>(DEFAULT_MOCK_HISTORY);
  const [selectedReceipt, setSelectedReceipt] = useState<TripHistoryItem | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchHistory = async () => {
      if (!isSignedIn) return;
      try {
        setLoading(true);
        const token = await getToken();
        if (!token) return;
        const res = await axios.get<{ success: boolean; data: TripHistoryItem[] }>(
          `${API_URL}/rides/history`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data?.data && res.data.data.length > 0) {
          setTrips(res.data.data);
        }
      } catch {
        // Fall back to realistic default trips
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, isSignedIn, getToken]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      {/* Main Container */}
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-neutral-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-neutral-100 flex items-center justify-center text-black">
              <Receipt size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-black tracking-tight">Your Activity</h2>
              <p className="text-xs text-neutral-500">Past rides & official receipts</p>
            </div>
          </div>
          <button
            id="btn-close-activity"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors text-black"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-neutral-400 text-sm animate-pulse">
              Loading your ride history…
            </div>
          ) : trips.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-2">🚗</div>
              <h3 className="text-base font-bold text-black">No rides yet</h3>
              <p className="text-xs text-neutral-500 mt-1">
                Your completed rides will show up here with receipts.
              </p>
            </div>
          ) : (
            trips.map((trip) => {
              const dateStr = new Date(trip.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
              const timeStr = new Date(trip.created_at).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });

              return (
                <div
                  key={trip.id}
                  className="bg-neutral-50 hover:bg-neutral-100/70 border border-neutral-200/80 rounded-2xl p-4 transition-all flex flex-col gap-3"
                >
                  {/* Top Bar: Date & Fare */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🚗</span>
                      <span className="text-sm font-bold text-black">{trip.ride_tier || 'UberGo'}</span>
                      <span className="text-xs text-neutral-400">·</span>
                      <span className="text-xs text-neutral-500">{dateStr}, {timeStr}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-black">
                        ₹{trip.fare_amount?.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Route points */}
                  <div className="space-y-1.5 pl-1 border-l-2 border-neutral-300 ml-2 py-0.5">
                    <div className="text-xs text-neutral-700 flex items-center gap-2 pl-2">
                      <span className="w-2 h-2 rounded-full bg-black -ml-[13px]" />
                      <span className="truncate">{trip.pickup_address}</span>
                    </div>
                    <div className="text-xs text-neutral-700 flex items-center gap-2 pl-2">
                      <span className="w-2 h-2 bg-black -ml-[13px]" />
                      <span className="truncate">{trip.dropoff_address}</span>
                    </div>
                  </div>

                  {/* Actions & Payment details */}
                  <div className="pt-2 border-t border-neutral-200/60 flex items-center justify-between text-xs">
                    <span className="text-neutral-500 flex items-center gap-1">
                      <CreditCard size={13} />
                      {trip.payment_method || 'Cash on Delivery'}
                    </span>
                    <button
                      id={`btn-view-receipt-${trip.id}`}
                      onClick={() => setSelectedReceipt(trip)}
                      className="px-3 py-1.5 bg-black text-white rounded-lg font-semibold hover:bg-neutral-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Receipt size={13} />
                      View Receipt
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── OFFICIAL PRINTABLE RECEIPT MODAL ─────────────────────────────── */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/75 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 border border-neutral-200 text-black">
            {/* Receipt Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div>
                <span className="text-2xl font-black tracking-tight">Uber</span>
                <p className="text-xs text-neutral-400">Official Trip Receipt</p>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-black"
              >
                <X size={16} />
              </button>
            </div>

            {/* Total Fare Hero */}
            <div className="text-center py-2 bg-neutral-50 rounded-2xl border border-neutral-100">
              <span className="text-xs text-neutral-400 uppercase tracking-wider font-bold">Total Paid</span>
              <div className="text-3xl font-black text-black mt-0.5">
                ₹{selectedReceipt.fare_amount?.toFixed(2)}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center justify-center gap-1 mt-1">
                <CheckCircle size={12} /> Paid with {selectedReceipt.payment_method || 'Cash on Delivery'}
              </span>
            </div>

            {/* Fare Breakdown Table */}
            <div className="space-y-2 text-xs py-2 border-y border-neutral-100">
              <div className="flex justify-between text-neutral-600">
                <span>Trip Fare ({selectedReceipt.ride_tier})</span>
                <span className="font-semibold text-black">
                  ₹{((selectedReceipt.fare_amount || 100) * 0.85).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Access & Platform Fee</span>
                <span className="font-semibold text-black">
                  ₹{((selectedReceipt.fare_amount || 100) * 0.1).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Taxes & GST (5%)</span>
                <span className="font-semibold text-black">
                  ₹{((selectedReceipt.fare_amount || 100) * 0.05).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-sm text-black pt-1 border-t border-neutral-100">
                <span>Amount Charged</span>
                <span>₹{selectedReceipt.fare_amount?.toFixed(2)}</span>
              </div>
            </div>

            {/* Trip Specs */}
            <div className="text-[11px] text-neutral-500 space-y-1 bg-neutral-50 p-3 rounded-xl">
              <div><strong className="text-neutral-700">Receipt ID:</strong> {selectedReceipt.id}</div>
              <div><strong className="text-neutral-700">Driver:</strong> {selectedReceipt.driver_name || 'Driver Partner'}</div>
              <div><strong className="text-neutral-700">Distance:</strong> {selectedReceipt.distance_km || 5.2} km</div>
            </div>

            {/* Print / Save button */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-black hover:bg-neutral-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Printer size={15} /> Print / Save PDF
              </button>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-5 py-3 border border-neutral-300 hover:bg-neutral-100 text-black rounded-xl font-semibold text-xs transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
