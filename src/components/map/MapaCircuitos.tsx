// src/components/map/MapaCircuitos.tsx
"use client";
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, useMap, useMapEvents, Tooltip } from "react-leaflet";
import L from "leaflet";
import type { CircuitoFeatureProps } from "@/types";

// Fix de íconos default de Leaflet (mismo workaround que MapaLeaflet)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const CABA_CENTER: [number, number] = [-34.6037, -58.3816];

const URGENCIA_COLOR: Record<string, string> = {
  ALTA: "#ef4444",
  MEDIA: "#eab308",
  BAJA: "#22c55e",
};

export interface ProblemaPunto {
  id: string;
  lat: number | null;
  lng: number | null;
  urgencia: string;
  tipo: string;
}

interface Props {
  geojson: any | null;
  selectedId: number | null;
  onSelectCircuito: (props: CircuitoFeatureProps) => void;
  /** Problemas (con lat/lng) a dibujar como puntos, normalmente los del circuito seleccionado. */
  problemas?: ProblemaPunto[];
  /** Cantidad de problemas por circuito_id, para colorear la intensidad del relleno. */
  countsByCircuito?: Record<number, number>;
  /** Modo "elegir punto" dentro del circuito (panel): un clic fija la ubicación del nuevo problema. */
  pickMode?: boolean;
  pickedPoint?: [number, number] | null;
  onPickPoint?: (lat: number, lng: number) => void;
}

function FitBounds({ geojson }: { geojson: any | null }) {
  const map = useMap();
  useEffect(() => {
    if (!geojson || !geojson.features?.length) return;
    try {
      const bounds = L.geoJSON(geojson).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
    } catch {
      /* geometría inválida: ignorar */
    }
  }, [geojson, map]);
  return null;
}

function PickHandler({ pickMode, onPickPoint }: { pickMode?: boolean; onPickPoint?: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click(e) {
      if (pickMode && onPickPoint) onPickPoint(e.latlng.lat, e.latlng.lng);
    },
  });
  useEffect(() => {
    map.getContainer().style.cursor = pickMode ? "crosshair" : "";
  }, [pickMode, map]);
  return null;
}

export default function MapaCircuitos({
  geojson,
  selectedId,
  onSelectCircuito,
  problemas = [],
  countsByCircuito,
  pickMode,
  pickedPoint,
  onPickPoint,
}: Props) {
  // Clave para re-montar la capa GeoJSON cuando cambia la selección o los conteos
  // (react-leaflet no recalcula estilos sobre la misma instancia).
  const geoKey = useMemo(() => {
    const n = geojson?.features?.length ?? 0;
    const countsSig = countsByCircuito ? Object.keys(countsByCircuito).length : 0;
    return `${n}-${selectedId ?? "none"}-${countsSig}`;
  }, [geojson, selectedId, countsByCircuito]);

  const maxCount = useMemo(() => {
    if (!countsByCircuito) return 0;
    return Object.values(countsByCircuito).reduce((m, v) => Math.max(m, v), 0);
  }, [countsByCircuito]);

  function styleFeature(feature: any) {
    const id = feature?.properties?.id as number;
    const isSelected = selectedId != null && id === selectedId;
    let fillOpacity = 0.12;
    if (countsByCircuito && maxCount > 0) {
      const c = countsByCircuito[id] ?? 0;
      fillOpacity = c === 0 ? 0.05 : 0.15 + 0.45 * (c / maxCount);
    }
    return {
      color: isSelected ? "#a5b4fc" : "#6366f1",
      weight: isSelected ? 3 : 1,
      fillColor: "#6366f1",
      fillOpacity: isSelected ? 0.45 : fillOpacity,
    };
  }

  const withGeo = useMemo(() => problemas.filter((p) => p.lat != null && p.lng != null), [problemas]);

  return (
    <MapContainer center={CABA_CENTER} zoom={12} style={{ height: "100%", width: "100%" }} className="z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds geojson={geojson} />
      <PickHandler pickMode={pickMode} onPickPoint={onPickPoint} />

      {geojson && (
        <GeoJSON
          key={geoKey}
          data={geojson}
          style={styleFeature as any}
          onEachFeature={(feature, layer) => {
            const props = feature.properties as CircuitoFeatureProps;
            const label = `Circuito ${props.codigo}${props.barrio ? ` · ${props.barrio}` : ""}`;
            layer.bindTooltip(label, { sticky: true, direction: "top" });
            layer.on("click", () => onSelectCircuito(props));
          }}
        />
      )}

      {/* Puntos de problemas (del circuito seleccionado) */}
      {withGeo.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat!, p.lng!]}
          radius={6}
          pathOptions={{
            color: "#fff",
            weight: 1,
            fillColor: URGENCIA_COLOR[p.urgencia] ?? "#6366f1",
            fillOpacity: 1,
          }}
        >
          <Tooltip>{p.tipo} · {p.urgencia}</Tooltip>
        </CircleMarker>
      ))}

      {/* Punto elegido para el nuevo problema (modo pick) */}
      {pickedPoint && (
        <CircleMarker
          center={pickedPoint}
          radius={8}
          pathOptions={{ color: "#fff", weight: 2, fillColor: "#6366f1", fillOpacity: 1 }}
        />
      )}
    </MapContainer>
  );
}
