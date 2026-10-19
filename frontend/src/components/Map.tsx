'use client';

import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';

// ─── Fix Leaflet default icon URLs (required in Next.js) ─────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Authentic Custom SVG Icons ──────────────────────────────────────────────
const createPickupPin = (label: string) =>
  L.divIcon({
    className: '',
    html: `
      <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
        <div style="
          background:#10B981; color:#fff; font-size:11px; font-weight:800; font-family:sans-serif;
          padding:3px 8px; border-radius:12px; white-space:nowrap; box-shadow:0 3px 10px rgba(0,0,0,0.35);
          display:flex; items-center:center; gap:4px; border:2px solid #fff; margin-bottom:4px;
        ">
          <span>🟢</span> From: ${label.split(',')[0]}
        </div>
        <div style="
          width:16px; height:16px; border-radius:50%; background:#10B981;
          border:3px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.4);
        "></div>
      </div>
    `,
    iconSize: [120, 48],
    iconAnchor: [60, 44],
  });

const createDropoffPin = (label: string) =>
  L.divIcon({
    className: '',
    html: `
      <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
        <div style="
          background:#EF4444; color:#fff; font-size:11px; font-weight:800; font-family:sans-serif;
          padding:3px 8px; border-radius:12px; white-space:nowrap; box-shadow:0 3px 10px rgba(0,0,0,0.35);
          display:flex; items-center:center; gap:4px; border:2px solid #fff; margin-bottom:4px;
        ">
          <span>🔴</span> To: ${label.split(',')[0]}
        </div>
        <div style="
          width:16px; height:16px; background:#EF4444;
          border:3px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.4);
        "></div>
      </div>
    `,
    iconSize: [120, 48],
    iconAnchor: [60, 44],
  });

const createDriverCarIcon = (heading: number = 0, driverText: string = 'Driver Partner • MH 04 DK 4019') =>
  L.divIcon({
    className: '',
    html: `
      <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
        <div style="
          background:#000000; color:#FFFFFF; font-size:10px; font-weight:700; font-family:sans-serif;
          padding:3px 7px; border-radius:8px; white-space:nowrap; box-shadow:0 3px 12px rgba(0,0,0,0.4);
          margin-bottom:4px; border:1px solid #333; display:flex; align-items:center; gap:3px;
        ">
          <span>🚘</span> ${driverText} <span style="color:#F59E0B">★ 4.9</span>
        </div>
        <div style="
          transform:rotate(${heading}deg); width:42px; height:42px; display:flex;
          align-items:center; justify-content:center;
        ">
          <svg width="38" height="38" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="17" fill="#000000" stroke="#FFFFFF" stroke-width="2"/>
            <path d="M12 22L13.5 16H22.5L24 22H12Z" fill="white"/>
            <path d="M13.5 16L14.5 12H21.5L22.5 16" fill="white"/>
            <circle cx="14.5" cy="22.5" r="1.5" fill="#333"/>
            <circle cx="21.5" cy="22.5" r="1.5" fill="#333"/>
            <rect x="15" y="13" width="6" height="2.5" rx="0.5" fill="#38BDF8" opacity="0.9"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [220, 64],
    iconAnchor: [110, 52],
  });

// ─── Types ────────────────────────────────────────────────────────────────────
interface Coords {
  lat: number;
  lng: number;
}

interface MapProps {
  pickupCoords: Coords | null;
  dropoffCoords: Coords | null;
  routeGeometry: [number, number][] | null; // [lng, lat] pairs from OSRM GeoJSON
  driverLocation: { lat: number; lng: number; heading?: number } | null;
  pickupAddress?: string;
  dropoffAddress?: string;
  driverName?: string;
  vehiclePlate?: string;
}

// Mumbai centroid
const MUMBAI_CENTER: [number, number] = [19.076, 72.8777];

export default function Map({
  pickupCoords,
  dropoffCoords,
  routeGeometry,
  driverLocation,
  pickupAddress = 'Pickup Point',
  dropoffAddress = 'Destination',
  driverName = 'Driver Partner',
  vehiclePlate = 'MH 04 DK 4019',
}: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const dropoffMarkerRef = useRef<L.Marker | null>(null);
  const carMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerGroupRef = useRef<L.FeatureGroup | null>(null);

  // ─── Initialize map once ───────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: MUMBAI_CENTER,
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    });

    // Clean OpenStreetMap tiles (100% free, no watermark)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Zoom controls bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ─── Update Pickup Pin ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    if (pickupMarkerRef.current) {
      mapRef.current.removeLayer(pickupMarkerRef.current);
      pickupMarkerRef.current = null;
    }
    if (pickupCoords) {
      pickupMarkerRef.current = L.marker([pickupCoords.lat, pickupCoords.lng], {
        icon: createPickupPin(pickupAddress),
        zIndexOffset: 600,
      }).addTo(mapRef.current);
    }
  }, [pickupCoords, pickupAddress]);

  // ─── Update Dropoff Pin ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    if (dropoffMarkerRef.current) {
      mapRef.current.removeLayer(dropoffMarkerRef.current);
      dropoffMarkerRef.current = null;
    }
    if (dropoffCoords) {
      dropoffMarkerRef.current = L.marker([dropoffCoords.lat, dropoffCoords.lng], {
        icon: createDropoffPin(dropoffAddress),
        zIndexOffset: 600,
      }).addTo(mapRef.current);
    }
  }, [dropoffCoords, dropoffAddress]);

  // ─── Draw Traffic-Colored Route Polyline ──────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    // Clean previous route
    if (routeLayerGroupRef.current) {
      mapRef.current.removeLayer(routeLayerGroupRef.current);
      routeLayerGroupRef.current = null;
    }

    if (!routeGeometry) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coords: [number, number][] = Array.isArray(routeGeometry)
      ? routeGeometry
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : (routeGeometry as any)?.coordinates || [];

    if (coords.length < 2) return;

    // Convert OSRM [lng, lat] -> Leaflet [lat, lng]
    const latlngs: [number, number][] = coords.map(([lng, lat]) => [lat, lng]);

    const group = L.featureGroup();

    // 1. Base dark blue casing under entire route
    const baseCasing = L.polyline(latlngs, {
      color: '#1E3A8A', // Deep Navy Casing
      weight: 9,
      opacity: 0.9,
      smoothFactor: 1.2,
      lineCap: 'round',
      lineJoin: 'round',
    });
    group.addLayer(baseCasing);

    // 2. Traffic Colored Lane Segments
    // Split into 3 realistic traffic segments:
    // - Segment 1 (first 55%): Clear Highway -> Deep Royal Blue (#2563EB)
    // - Segment 2 (next 25%): Moderate Slowdown -> Amber / Yellow (#F59E0B)
    // - Segment 3 (final 20%): Congested City Approach -> Vibrant Red (#EF4444)
    const totalPts = latlngs.length;
    const split1 = Math.floor(totalPts * 0.55);
    const split2 = Math.floor(totalPts * 0.80);

    const seg1 = latlngs.slice(0, split1 + 1);
    const seg2 = latlngs.slice(split1, split2 + 1);
    const seg3 = latlngs.slice(split2);

    if (seg1.length >= 2) {
      group.addLayer(
        L.polyline(seg1, {
          color: '#2563EB', // Blue (Clear Highway)
          weight: 6,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        })
      );
    }

    if (seg2.length >= 2) {
      group.addLayer(
        L.polyline(seg2, {
          color: '#F59E0B', // Amber (Moderate Traffic)
          weight: 6,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        })
      );
    }

    if (seg3.length >= 2) {
      group.addLayer(
        L.polyline(seg3, {
          color: '#EF4444', // Red (Heavy City Traffic)
          weight: 6,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        })
      );
    }

    group.addTo(mapRef.current);
    routeLayerGroupRef.current = group;

    // Fit map bounds to view entire route
    mapRef.current.fitBounds(baseCasing.getBounds(), {
      padding: [80, 80],
      maxZoom: 15,
    });
  }, [routeGeometry]);

  // ─── Driver Marker (Live GPS with open tooltip label) ─────────────────────
  const updateCarMarker = useCallback(() => {
    if (!mapRef.current || !driverLocation) return;
    const { lat, lng, heading = 0 } = driverLocation;
    const driverLabel = `${driverName} (${vehiclePlate})`;

    if (carMarkerRef.current) {
      carMarkerRef.current.setLatLng([lat, lng]);
      carMarkerRef.current.setIcon(createDriverCarIcon(heading, driverLabel));
    } else {
      carMarkerRef.current = L.marker([lat, lng], {
        icon: createDriverCarIcon(heading, driverLabel),
        zIndexOffset: 1000,
      }).addTo(mapRef.current);
    }
  }, [driverLocation, driverName, vehiclePlate]);

  useEffect(() => {
    updateCarMarker();
  }, [updateCarMarker]);

  // ─── Fit to both coordinates when route not yet generated ─────────────────
  useEffect(() => {
    if (!mapRef.current || routeGeometry) return;
    if (pickupCoords && dropoffCoords) {
      const bounds = L.latLngBounds(
        [pickupCoords.lat, pickupCoords.lng],
        [dropoffCoords.lat, dropoffCoords.lng]
      );
      mapRef.current.fitBounds(bounds, { padding: [100, 100], maxZoom: 15 });
    } else if (pickupCoords) {
      mapRef.current.setView([pickupCoords.lat, pickupCoords.lng], 14, { animate: true });
    }
  }, [pickupCoords, dropoffCoords, routeGeometry]);

  return (
    <div
      ref={containerRef}
      id="map-canvas"
      className="w-full h-full relative"
      style={{ minHeight: 0 }}
    />
  );
}
