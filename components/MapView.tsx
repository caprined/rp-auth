'use client';

import { useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { RefreshCw } from 'lucide-react';

const WORLD_TOPOJSON_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface GeoPoint {
  discord_id: string;
  global_name: string | null;
  username: string;
  geo_country: string | null;
  geo_city: string | null;
  geo_lat: number;
  geo_lng: number;
}

export default function MapView() {
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<GeoPoint | null>(null);

  useEffect(() => {
    fetch('/api/admin/map')
      .then((res) => res.json())
      .then((data) => setPoints(data.points ?? []))
      .finally(() => setLoading(false));
  }, []);

  const countryCounts = points.reduce<Record<string, number>>((acc, p) => {
    const key = p.geo_country ?? 'Nieznany';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-xl border border-border1 bg-surface1 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Skąd weryfikują się userzy</h2>
        <span className="text-xs text-textMuted">{points.length} lokalizacji</span>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-textMuted">
          <RefreshCw className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <div className="relative overflow-hidden rounded-lg bg-surface2">
            <ComposableMap
              projectionConfig={{ scale: 140 }}
              style={{ width: '100%', height: 'auto' }}
            >
              <Geographies geography={WORLD_TOPOJSON_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#2e2e2e"
                      stroke="#1a1a1a"
                      strokeWidth={0.5}
                      style={{ outline: 'none' }}
                    />
                  ))
                }
              </Geographies>
              {points.map((p) => (
                <Marker
                  key={p.discord_id}
                  coordinates={[p.geo_lng, p.geo_lat]}
                  onMouseEnter={() => setHovered(p)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <circle r={3.5} fill="#b45925" stroke="#eaeaea" strokeWidth={0.5} opacity={0.9} />
                </Marker>
              ))}
            </ComposableMap>

            {hovered && (
              <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg border border-border1 bg-surface1 px-3 py-1.5 text-xs">
                <span className="font-medium">{hovered.global_name ?? hovered.username}</span>
                <span className="text-textMuted"> — {hovered.geo_city ?? '?'}, {hovered.geo_country ?? '?'}</span>
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs text-textMuted">Kraje:</p>
            <ul className="space-y-1 text-xs">
              {topCountries.map(([country, count]) => (
                <li key={country} className="flex justify-between gap-2 rounded-lg bg-surface2 px-2.5 py-1.5">
                  <span className="truncate text-textSecondary">{country}</span>
                  <span className="mono shrink-0 text-textMuted">{count}</span>
                </li>
              ))}
              {topCountries.length === 0 && <li className="text-textMuted">Brak danych.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
