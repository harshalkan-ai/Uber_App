'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Square, Plus, ChevronDown, Clock, User, Tag } from 'lucide-react';
import axios from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LocationSuggestion {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
}

interface Coords {
  lat: number;
  lng: number;
}

interface FareEstimate {
  tier: string;
  price: number;
  originalPrice: number;
  durationMinutes: number;
  distanceKm: number;
}

interface RideEstimateResult {
  route: {
    distanceKm: number;
    durationMinutes: number;
    geometry: [number, number][];
  };
  estimates: FareEstimate[];
}

interface RideSearchCardProps {
  onPickupChange: (coords: Coords | null, address: string) => void;
  onDropoffChange: (coords: Coords | null, address: string) => void;
  onEstimateResult: (result: RideEstimateResult | null) => void;
  getAuthToken: () => Promise<string | null>;
  isMobile?: boolean;
}

const LOCATIONIQ_KEY = process.env.NEXT_PUBLIC_LOCATIONIQ_KEY!;
const API_URL = process.env.NEXT_PUBLIC_API_URL!;

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function RideSearchCard({
  onPickupChange,
  onDropoffChange,
  onEstimateResult,
  getAuthToken,
  isMobile = false,
}: RideSearchCardProps) {
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [pickupCoords, setPickupCoords] = useState<Coords | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<Coords | null>(null);
  const [pickupSuggestions, setPickupSuggestions] = useState<LocationSuggestion[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<LocationSuggestion[]>([]);
  const [focusedField, setFocusedField] = useState<'pickup' | 'dropoff' | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const debouncedPickup = useDebounce(pickupText, 300);
  const debouncedDropoff = useDebounce(dropoffText, 300);
  const pickupRef = useRef<HTMLInputElement>(null);
  const dropoffRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── LocationIQ autocomplete ───────────────────────────────────────────────
  const fetchSuggestions = useCallback(
    async (query: string, field: 'pickup' | 'dropoff') => {
      const q = query.trim();
      if (q.length < 2) {
        field === 'pickup' ? setPickupSuggestions([]) : setDropoffSuggestions([]);
        return;
      }
      setIsLoadingSuggestions(true);
      try {
        const { data } = await axios.get<LocationSuggestion[]>(
          `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(q)}&limit=5&format=json`
        );
        field === 'pickup' ? setPickupSuggestions(data || []) : setDropoffSuggestions(data || []);
      } catch {
        field === 'pickup' ? setPickupSuggestions([]) : setDropoffSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    },
    []
  );

  useEffect(() => {
    if (focusedField === 'pickup') fetchSuggestions(debouncedPickup, 'pickup');
  }, [debouncedPickup, focusedField, fetchSuggestions]);

  useEffect(() => {
    if (focusedField === 'dropoff') fetchSuggestions(debouncedDropoff, 'dropoff');
  }, [debouncedDropoff, focusedField, fetchSuggestions]);

  // ─── Suggestion selection ──────────────────────────────────────────────────
  const selectSuggestion = useCallback(
    (suggestion: LocationSuggestion, field: 'pickup' | 'dropoff') => {
      const coords: Coords = {
        lat: parseFloat(suggestion.lat),
        lng: parseFloat(suggestion.lon),
      };
      const shortName = suggestion.display_name;
      if (field === 'pickup') {
        setPickupText(shortName);
        setPickupCoords(coords);
        setPickupSuggestions([]);
        onPickupChange(coords, shortName);
      } else {
        setDropoffText(shortName);
        setDropoffCoords(coords);
        setDropoffSuggestions([]);
        onDropoffChange(coords, shortName);
      }
      setFocusedField(null);
    },
    [onPickupChange, onDropoffChange]
  );

  // ─── Get user location for pickup ─────────────────────────────────────────
  const getMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      try {
        const { data } = await axios.get(
          `https://api.locationiq.com/v1/reverse?key=${LOCATIONIQ_KEY}&lat=${lat}&lon=${lng}&format=json`
        );
        const address = data.display_name;
        setPickupText(address);
        setPickupCoords({ lat, lng });
        onPickupChange({ lat, lng }, address);
      } catch {
        const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setPickupText(fallback);
        setPickupCoords({ lat, lng });
        onPickupChange({ lat, lng }, fallback);
      }
      setFocusedField(null);
    });
  };

  // ─── Estimate fare ─────────────────────────────────────────────────────────
  const estimateFare = async () => {
    if (!pickupText.trim() || !dropoffText.trim()) {
      setEstimateError('Please enter both pickup and dropoff locations.');
      return;
    }
    setEstimateError(null);
    setIsEstimating(true);
    try {
      let pCoords = pickupCoords;
      if (!pCoords) {
        try {
          const { data } = await axios.get<LocationSuggestion[]>(
            `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(pickupText.trim())}&limit=1&format=json`
          );
          if (data && data.length > 0) {
            pCoords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            setPickupCoords(pCoords);
            onPickupChange(pCoords, pickupText);
          }
        } catch {
          // fallback
        }
      }

      let dCoords = dropoffCoords;
      if (!dCoords) {
        try {
          const { data } = await axios.get<LocationSuggestion[]>(
            `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(dropoffText.trim())}&limit=1&format=json`
          );
          if (data && data.length > 0) {
            dCoords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            setDropoffCoords(dCoords);
            onDropoffChange(dCoords, dropoffText);
          }
        } catch {
          // fallback
        }
      }

      if (!pCoords || !dCoords) {
        setEstimateError('Please select valid pickup and dropoff locations.');
        setIsEstimating(false);
        return;
      }

      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await axios.post<{ success: boolean; data: any }>(
        `${API_URL}/rides/estimate`,
        {
          pickup_lat: pCoords.lat,
          pickup_lng: pCoords.lng,
          dropoff_lat: dCoords.lat,
          dropoff_lng: dCoords.lng,
        },
        { headers }
      );

      const rawRoute = data.data?.route;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawEstimates = (data.data?.estimates || []) as any[];

      const coordinates: [number, number][] = Array.isArray(rawRoute?.geometry)
        ? rawRoute.geometry
        : Array.isArray(rawRoute?.geometry?.coordinates)
        ? rawRoute.geometry.coordinates
        : [];

      const normalizedEstimates: FareEstimate[] = rawEstimates.map((e) => {
        const tierName = e.rideTier || e.tier || 'UberGo';
        const priceVal = Number(e.fareAmount ?? e.price ?? 100);
        return {
          tier: tierName,
          price: priceVal,
          originalPrice: Number(e.originalPrice ?? Math.round(priceVal * 1.2)),
          durationMinutes: Number(e.durationMinutes ?? rawRoute?.durationMinutes ?? 15),
          distanceKm: Number(e.distanceKm ?? rawRoute?.distanceKm ?? 5),
        };
      });

      onEstimateResult({
        route: {
          distanceKm: Number(rawRoute?.distanceKm || 0),
          durationMinutes: Number(rawRoute?.durationMinutes || 0),
          geometry: coordinates,
        },
        estimates: normalizedEstimates,
      });
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err)
          ? err.response?.data?.message || 'Failed to get fare estimate.'
          : 'Something went wrong.';
      setEstimateError(message);
      onEstimateResult(null);
    } finally {
      setIsEstimating(false);
    }
  };

  // ─── Close dropdowns on outside click ────────────────────────────────────
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocusedField(null);
        setPickupSuggestions([]);
        setDropoffSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isFormFilled = pickupText.trim().length > 0 && dropoffText.trim().length > 0;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col rounded-2xl bg-white w-full animate-fadeInUp ${
        isMobile ? 'border-0 shadow-none p-0' : 'p-5 shadow-2xl border border-neutral-200 gap-3'
      }`}
    >
      {/* Top Handle Bar for mobile drawer */}
      <div className="w-12 h-1.5 bg-neutral-300 rounded-full mx-auto mb-4" />

      {/* Heading */}
      <h1 className="text-2xl font-black text-black tracking-tight mb-2">
        Where can we pick you up?
      </h1>

      {/* Promo Pill */}
      <div className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-xs font-semibold px-3 py-1.5 rounded-full w-fit mb-2">
        <Tag size={12} className="flex-shrink-0" />
        🏷️ 100% off your next ride. Up to ₹90
      </div>

      {/* Connected Route Inputs */}
      <div className="relative flex items-stretch gap-3 mb-2">
        {/* Signature Connected Indicator */}
        <div className="flex flex-col items-center justify-between py-3 flex-shrink-0 select-none">
          {/* Pickup Circle 🔘 */}
          <div className="w-3.5 h-3.5 rounded-full border-[3px] border-black bg-white flex-shrink-0" />
          {/* Vertical Connecting Line */}
          <div className="w-0.5 h-8 bg-neutral-300 my-1" />
          {/* Dropoff Square ⬛ */}
          <div className="w-3.5 h-3.5 bg-black flex-shrink-0" />
        </div>

        {/* Inputs Column */}
        <div className="flex-1 flex flex-col gap-2 relative">
          {/* Pickup Input Container */}
          <div className="relative">
            <div className="flex items-center bg-neutral-100 rounded-xl px-4 py-3 transition-all focus-within:ring-2 focus-within:ring-black focus-within:bg-white">
              <input
                ref={pickupRef}
                id="input-pickup"
                type="text"
                placeholder="Pickup location"
                value={pickupText}
                onChange={(e) => {
                  setPickupText(e.target.value);
                  if (pickupCoords) {
                    setPickupCoords(null);
                    onPickupChange(null, '');
                    onEstimateResult(null);
                  }
                }}
                onFocus={() => setFocusedField('pickup')}
                className="flex-1 text-sm font-medium text-black placeholder-neutral-400 bg-transparent outline-none"
                autoComplete="off"
              />
              {pickupText && (
                <button
                  type="button"
                  onClick={() => {
                    setPickupText('');
                    setPickupCoords(null);
                    setPickupSuggestions([]);
                    onPickupChange(null, '');
                    onEstimateResult(null);
                  }}
                  className="text-neutral-400 hover:text-neutral-600 text-lg leading-none px-1"
                  aria-label="Clear pickup"
                >
                  ×
                </button>
              )}
            </div>

            {/* LocationIQ Pickup Suggestions Dropdown */}
            {focusedField === 'pickup' && (pickupSuggestions.length > 0 || !pickupCoords) && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                {!pickupCoords && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      getMyLocation();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-black hover:bg-neutral-50 transition-colors border-b border-neutral-100 text-left font-medium"
                  >
                    <span className="text-base flex-shrink-0">📍</span>
                    <span>Use my current location</span>
                  </button>
                )}

                {pickupSuggestions.map((s) => (
                  <button
                    key={s.place_id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSuggestion(s, 'pickup');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-black hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-b-0 text-left"
                  >
                    <span className="text-base flex-shrink-0">📍</span>
                    <span className="flex-1 truncate">{s.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dropoff Input Container */}
          <div className="relative">
            <div className="flex items-center bg-neutral-100 rounded-xl px-4 py-3 transition-all focus-within:ring-2 focus-within:ring-black focus-within:bg-white">
              <input
                ref={dropoffRef}
                id="input-dropoff"
                type="text"
                placeholder="Where to?"
                value={dropoffText}
                onChange={(e) => {
                  setDropoffText(e.target.value);
                  if (dropoffCoords) {
                    setDropoffCoords(null);
                    onDropoffChange(null, '');
                    onEstimateResult(null);
                  }
                }}
                onFocus={() => setFocusedField('dropoff')}
                className="flex-1 text-sm font-medium text-black placeholder-neutral-400 bg-transparent outline-none"
                autoComplete="off"
              />
              {dropoffText ? (
                <button
                  type="button"
                  onClick={() => {
                    setDropoffText('');
                    setDropoffCoords(null);
                    setDropoffSuggestions([]);
                    onDropoffChange(null, '');
                    onEstimateResult(null);
                  }}
                  className="text-neutral-400 hover:text-neutral-600 text-lg leading-none px-1"
                  aria-label="Clear dropoff"
                >
                  ×
                </button>
              ) : (
                <button
                  type="button"
                  title="Add stop"
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-neutral-200 hover:bg-neutral-300 transition-colors flex-shrink-0"
                >
                  <Plus size={12} className="text-neutral-600" />
                </button>
              )}
            </div>

            {/* LocationIQ Dropoff Suggestions Dropdown */}
            {focusedField === 'dropoff' && dropoffSuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                {dropoffSuggestions.map((s) => (
                  <button
                    key={s.place_id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSuggestion(s, 'dropoff');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-black hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-b-0 text-left"
                  >
                    <span className="text-base flex-shrink-0">📍</span>
                    <span className="flex-1 truncate">{s.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pill Selectors */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          id="btn-pickup-time"
          className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-full text-xs font-semibold text-black transition-colors"
        >
          <Clock size={13} />
          Pickup now
          <ChevronDown size={12} />
        </button>
        <button
          type="button"
          id="btn-for-whom"
          className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-full text-xs font-semibold text-black transition-colors"
        >
          <User size={13} />
          For me
          <ChevronDown size={12} />
        </button>
      </div>

      {/* Error Message */}
      {estimateError && (
        <div className="mb-2 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-700 animate-fadeIn">
          {estimateError}
        </div>
      )}

      {/* Active Search Button */}
      <button
        type="button"
        id="btn-search-rides"
        onClick={estimateFare}
        disabled={isEstimating || !isFormFilled}
        className={`w-full py-4 rounded-xl text-base font-bold transition-all shadow-lg ${
          isEstimating || !isFormFilled
            ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
            : 'bg-black text-white hover:bg-neutral-800 cursor-pointer active:scale-[0.98]'
        }`}
      >
        {isEstimating ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Searching…
          </span>
        ) : (
          'Search Rides'
        )}
      </button>

      {isLoadingSuggestions && (
        <div className="text-[11px] text-neutral-400 text-center mt-1">Searching locations…</div>
      )}
    </div>
  );
}
