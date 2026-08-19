import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { ENDPOINTS } from '../config';
import { authHeaders, errorFromResponse, toMessage } from '../lib/api';

const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

const NATIONAL_CENTER: [number, number] = [-97, 38];
const NATIONAL_ZOOM = 1;
const REGION_ZOOM = 4;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

interface Region {
  /** State code used as the store-id prefix, e.g. "CA". */
  code: string;
  name: string;
  center: [number, number];
  /** Store IDs that actually came back from the API. */
  stores: string[];
}

/** Where each state's stores sit on the map, and how they fan out once zoomed in. */
const REGION_META: Record<string, { name: string; center: [number, number] }> = {
  CA: { name: 'California', center: [-119.4179, 36.7783] },
  TX: { name: 'Texas', center: [-99.9018, 31.9686] },
  WI: { name: 'Wisconsin', center: [-89.6165, 44.7844] },
};

export default function MapDashboard() {
  const navigate = useNavigate();
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [center, setCenter] = useState<[number, number]>(NATIONAL_CENTER);
  const [zoom, setZoom] = useState(NATIONAL_ZOOM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userRole = localStorage.getItem('user_role');
    const storeId = localStorage.getItem('store_id');
    if (userRole === 'STORE_OWNER' && storeId) {
      navigate(`/dashboard/store/${storeId}`);
    }
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(ENDPOINTS.data.stores, { headers: authHeaders() });
        if (!response.ok) throw new Error(await errorFromResponse(response, 'Could not load stores'));
        const data: { stores?: string[] } = await response.json();

        // Group the store IDs the API actually returned. The previous version fetched this
        // list and then discarded it, always rendering the same three hardcoded pins.
        const grouped = new Map<string, string[]>();
        for (const storeId of data.stores ?? []) {
          const code = storeId.split('_')[0];
          grouped.set(code, [...(grouped.get(code) ?? []), storeId]);
        }

        const built: Region[] = [...grouped.entries()]
          .filter(([code]) => REGION_META[code])
          .map(([code, stores]) => ({
            code,
            name: REGION_META[code].name,
            center: REGION_META[code].center,
            stores: stores.sort(),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!cancelled) setRegions(built);
      } catch (err: unknown) {
        if (!cancelled) setError(toMessage(err, 'Could not load stores'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(
    () => regions.find((region) => region.code === selectedCode) ?? null,
    [regions, selectedCode],
  );

  const focusRegion = useCallback((region: Region) => {
    setSelectedCode(region.code);
    setCenter(region.center);
    setZoom(REGION_ZOOM);
  }, []);

  const resetView = useCallback(() => {
    setSelectedCode(null);
    setCenter(NATIONAL_CENTER);
    setZoom(NATIONAL_ZOOM);
  }, []);

  const stepZoom = useCallback((factor: number) => {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current * factor)));
  }, []);

  /** Fan a region's stores out around its centre so they do not stack on one point. */
  const storePositions = useMemo(() => {
    if (!selected) return [];
    const count = selected.stores.length;
    const radius = 1.6;
    return selected.stores.map((storeId, index) => {
      const angle = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
      return {
        storeId,
        coordinates: [
          selected.center[0] + Math.cos(angle) * radius * 1.3,
          selected.center[1] + Math.sin(angle) * radius,
        ] as [number, number],
      };
    });
  }, [selected]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 h-full items-center justify-center" role="status">
        <span className="material-symbols-outlined text-primary text-[32px] animate-spin" aria-hidden="true">sync</span>
        <p className="font-label-caps text-[12px] text-primary uppercase tracking-widest">Loading map…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight m-0">HQ Command Center</h1>
          <p className="text-on-surface-variant text-sm mt-1 mb-0">
            {selected
              ? `${selected.name} — ${selected.stores.length} ${selected.stores.length === 1 ? 'store' : 'stores'}. Pick one to forecast.`
              : 'Select a state to zoom in. Scroll, pinch or drag to move around.'}
          </p>
        </div>

        <div className="flex items-center gap-2" role="group" aria-label="Map controls">
          <button
            type="button" onClick={() => stepZoom(1.5)} disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white text-lg leading-none border border-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >+</button>
          <button
            type="button" onClick={() => stepZoom(1 / 1.5)} disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white text-lg leading-none border border-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >−</button>
          <button
            type="button" onClick={resetView}
            className="h-10 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm border border-white/10 transition-colors"
          >
            Reset view
          </button>
        </div>
      </div>

      {/* Region shortcuts. The map itself needs a pointer; these do not. */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Jump to a state">
        {regions.map((region) => {
          const active = region.code === selectedCode;
          return (
            <button
              key={region.code}
              type="button"
              onClick={() => focusRegion(region)}
              aria-pressed={active}
              className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-widest border transition-colors ${
                active
                  ? 'bg-primary-container text-black border-transparent font-semibold'
                  : 'bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {region.name}
              <span className="ml-2 opacity-70">{region.stores.length}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-red-300 text-sm bg-red-900/30 border border-red-700 rounded-lg p-3 m-0">
          {error}
        </p>
      )}

      <div
        className="relative w-full h-[68vh] bg-[#0a0a0a] rounded-2xl overflow-hidden border border-white/5 shadow-2xl"
        role="application"
        aria-label="United States store map. Use the buttons above to zoom, or the state list to jump to a region."
      >
        <ComposableMap projection="geoAlbersUsa" className="w-full h-full">
          <ZoomableGroup
            center={center}
            zoom={zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            onMoveEnd={({ coordinates, zoom: nextZoom }) => {
              // Keep React in step with pan/pinch gestures, otherwise the next programmatic
              // zoom snaps the map back to wherever state last was.
              setCenter(coordinates);
              setZoom(nextZoom);
            }}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const region = regions.find((r) => r.name === geo.properties.name);
                  const active = region?.code === selectedCode;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      // Whole states are now clickable, not just the pins.
                      onClick={region ? () => focusRegion(region) : undefined}
                      tabIndex={-1}
                      fill={active ? '#1f3a5f' : region ? '#20262e' : '#161616'}
                      stroke={region ? '#4a5568' : '#2c2c2c'}
                      strokeWidth={region ? 0.7 : 0.4}
                      style={{
                        default: { outline: 'none', transition: 'fill 200ms' },
                        hover: { fill: region ? '#2b4a72' : '#1e1e1e', outline: 'none', cursor: region ? 'pointer' : 'default' },
                        pressed: { fill: '#35597f', outline: 'none' },
                      }}
                    />
                  );
                })
              }
            </Geographies>

            {!selected &&
              regions.map((region) => (
                <Marker
                  key={region.code}
                  coordinates={region.center}
                  onClick={() => focusRegion(region)}
                  className="cursor-pointer"
                >
                  <circle r={7} fill="#3b82f6" fillOpacity={0.25} />
                  <circle r={3.5} fill="#60a5fa" stroke="#0a0a0a" strokeWidth={0.8} />
                  <text
                    textAnchor="middle" y={-11}
                    style={{ fill: '#e5e7eb', fontSize: 7, fontWeight: 600, letterSpacing: 0.5 }}
                  >
                    {region.name}
                  </text>
                  <text
                    textAnchor="middle" y={16}
                    style={{ fill: '#9ca3af', fontSize: 5.5 }}
                  >
                    {region.stores.length} stores
                  </text>
                </Marker>
              ))}

            {selected &&
              storePositions.map(({ storeId, coordinates }) => (
                <Marker
                  key={storeId}
                  coordinates={coordinates}
                  onClick={() => navigate(`/dashboard/store/${storeId}`)}
                  className="cursor-pointer"
                >
                  <circle r={2.6} fill="#ffc220" stroke="#0a0a0a" strokeWidth={0.5} />
                  <text
                    textAnchor="middle" y={-4.5}
                    style={{ fill: '#fff', fontSize: 3.2, fontWeight: 700 }}
                  >
                    {storeId}
                  </text>
                </Marker>
              ))}
          </ZoomableGroup>
        </ComposableMap>

        <p className="absolute bottom-3 right-4 text-[11px] text-white/35 m-0 pointer-events-none">
          zoom {zoom.toFixed(1)}×
        </p>
      </div>

      {/* Same destinations as the pins, reachable without a pointer. */}
      {selected && (
        <div>
          <h2 className="text-sm uppercase tracking-widest text-on-surface-variant mb-3">
            {selected.name} stores
          </h2>
          <div className="flex flex-wrap gap-2">
            {selected.stores.map((storeId) => (
              <button
                key={storeId}
                type="button"
                onClick={() => navigate(`/dashboard/store/${storeId}`)}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm border border-white/10 transition-colors font-mono"
              >
                {storeId}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
