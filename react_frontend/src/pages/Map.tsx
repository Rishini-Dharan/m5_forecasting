import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { ENDPOINTS } from "../config";

const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

interface StoreMarker {
  name: string;
  id: string;
  coordinates: [number, number];
  stores: string[];
}

export default function MapDashboard() {
  const navigate = useNavigate();
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [-96, 38],
    zoom: 1,
  });
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [stores, setStores] = useState<StoreMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeDetails, setStoreDetails] = useState<Record<string, any>>({});

  const US_STORES: StoreMarker[] = [
    { name: "California", id: "CA_1", coordinates: [-122.4194, 37.7749], stores: ["CA_1", "CA_2", "CA_3", "CA_4"] },
    { name: "Texas", id: "TX_1", coordinates: [-97.7431, 30.2672], stores: ["TX_1", "TX_2", "TX_3"] },
    { name: "Wisconsin", id: "WI_1", coordinates: [-89.3830, 43.0731], stores: ["WI_1", "WI_2", "WI_3"] },
  ];

  useEffect(() => {
    const userRole = localStorage.getItem("user_role");
    const storeId = localStorage.getItem("store_id");
    if (userRole === "STORE_OWNER" && storeId) {
      navigate(`/dashboard/store/${storeId}`);
    }
  }, [navigate]);

  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        const response = await fetch(ENDPOINTS.data.stores, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwt") || ""}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.stores && data.stores.length > 0) {
            // Map store IDs to regions
            const storeMarkers: StoreMarker[] = [];
            const regions: Record<string, StoreMarker[]> = {
              CA: [],
              TX: [],
              WI: [],
              Other: [],
            };

            data.stores.forEach((storeId: string) => {
              const prefix = storeId.split("_")[0];
              if (!regions[prefix]) {
                regions[prefix] = [];
              }
            });

            // Use predefined mapping for known stores, fallback to grouping by prefix
            US_STORES.forEach((m) => {
              storeMarkers.push(m);
            });

            setStores(storeMarkers);
          }
        }
      } catch (e) {
        console.error("Failed to fetch store data:", e);
        setStores(US_STORES);
      } finally {
        setLoading(false);
      }
    };

    fetchStoreData();
  }, []);

  const handleMarkerClick = (marker: StoreMarker) => {
    setPosition({ coordinates: marker.coordinates, zoom: 4 });
    setSelectedState(marker.name);
  };

  const handleReset = () => {
    setPosition({ coordinates: [-96, 38], zoom: 1 });
    setSelectedState(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-8 h-full items-center justify-center">
        <span className="material-symbols-outlined text-primary text-[32px] animate-spin">sync</span>
        <p className="font-label-caps text-[12px] text-primary uppercase tracking-widest">
          Loading Map...
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[75vh] bg-[#0a0a0a] rounded-2xl overflow-hidden border border-white/5 shadow-2xl flex flex-col items-center justify-center">
      {/* Title / Controls Overlay */}
      <div className="absolute top-6 left-8 z-10 pointer-events-none">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
          HQ Command Center
        </h1>
        <p className="text-on-surface-variant text-sm tracking-wide">
          Select a region to view store details.
        </p>

        {selectedState && (
          <button
            onClick={handleReset}
            className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-300 font-medium tracking-wide border border-white/10 pointer-events-auto"
          >
            ← Back to National View
          </button>
        )}
      </div>

      {/* The Map */}
      <ComposableMap projection="geoAlbersUsa" className="w-full h-full">
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#1a1a1a"
                stroke="#333"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none", transition: "all 250ms" },
                  hover: { fill: "#2a2a2a", outline: "none" },
                  pressed: { fill: "#3a3a3a", outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {/* Render Main State Markers */}
        {!selectedState &&
          stores.map(({ name, coordinates }) => (
            <Marker
              key={name}
              coordinates={coordinates}
              onClick={() => handleMarkerClick({ name, coordinates, stores: [], id: name })}
            >
              <g
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                transform="translate(-12, -24)"
                className="cursor-pointer hover:stroke-blue-400 transition-colors drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]"
              >
                <circle cx="12" cy="10" r="3" />
                <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
              </g>
              <text
                textAnchor="middle"
                y={15}
                style={{ fill: "#fff", fontSize: "10px", fontWeight: "600", letterSpacing: "1px" }}
              >
                {name}
              </text>
            </Marker>
          ))}

        {/* Render Individual Store Markers when zoomed in */}
        {selectedState &&
          stores.find((m) => m.name === selectedState)?.stores.map((storeId, i) => {
            const baseCoords = stores.find((m) => m.name === selectedState)!.coordinates;
            const offsetCoords: [number, number] = [
              baseCoords[0] + (i * 0.5) - 0.5,
              baseCoords[1] + (i * 0.2) - 0.2,
            ];

            return (
              <Marker
                key={storeId}
                coordinates={offsetCoords}
                onClick={() => navigate(`/dashboard/store/${storeId}`)}
              >
                <g className="cursor-pointer">
                  <circle
                    cx="0"
                    cy="0"
                    r="4"
                    fill="#3b82f6"
                    className="drop-shadow-[0_0_10px_rgba(59,130,246,1)] animate-pulse"
                  />
                  <text
                    textAnchor="middle"
                    y={-10}
                    style={{ fill: "#fff", fontSize: "4px", fontWeight: "bold" }}
                  >
                    {storeId}
                  </text>
                </g>
              </Marker>
            );
          })}
      </ComposableMap>
    </div>
  );
}