// src/components/map/MapaLeaflet.tsx
"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { ReclamoPublico } from "@/types";


// Fix default Leaflet icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Helper to generate a consistent, high-contrast color from a string
function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use Golden Ratio to spread colors more evenly
  const goldenRatioConjugate = 0.618033988749895;
  let h = (Math.abs(hash) * goldenRatioConjugate) % 1;

  // Convert 0-1 to 0-360
  const hue = Math.floor(h * 360);

  // Vibrant but distinct: 75% saturation, 45% lightness (so white border pops)
  return `hsl(${hue}, 75%, 45%)`;
}

function makeIcon(tipo: string) {
  const color = stringToColor(tipo);
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 22px; height: 22px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}

const URGENCIA_LABEL: Record<string, string> = {
  ALTA: "🔴 ALTA",
  MEDIA: "🟡 MEDIA",
  BAJA: "🟢 BAJA",
};

// CABA center
const CABA_CENTER: [number, number] = [-34.6037, -58.3816];

interface Props {
  reclamos: ReclamoPublico[];
}

function FitBounds({ reclamos }: Props) {
  const map = useMap();
  useEffect(() => {
    const points = reclamos.filter((r) => r.lat && r.lng);
    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map((r) => [r.lat!, r.lng!]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [reclamos, map]);
  return null;
}

export default function MapaLeaflet({ reclamos }: Props) {
  const withGeo = reclamos.filter((r) => r.lat && r.lng);

  return (
    <MapContainer
      center={CABA_CENTER}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds reclamos={withGeo} />
      {withGeo.map((r) => (
        <Marker key={r.id} position={[r.lat!, r.lng!]} icon={makeIcon(r.tipo_reclamo)}>
          <Popup className="lla-popup-light">
            <div className="text-[11px] min-w-[200px] p-1">
              <div className="font-black text-primary uppercase tracking-widest mb-2 border-b border-gray-100 pb-1">{r.tipo_reclamo}</div>
              <div className="mb-1 flex justify-between">
                <span className="text-gray-400 font-bold uppercase tracking-tighter">Urgencia</span>
                <span className="font-black">{URGENCIA_LABEL[r.urgencia]}</span>
              </div>
              <div className="mb-3 flex justify-between">
                <span className="text-gray-400 font-bold uppercase tracking-tighter">Comuna</span>
                <span className="font-black">{String(r.comuna_id).padStart(2, "0")}</span>
              </div>
              <div className="mb-2 text-gray-800 font-medium leading-tight">{r.direccion_normalizada ?? r.direccion_raw}</div>
              <div className="text-gray-500 italic mb-3 leading-relaxed border-l-2 border-primary pl-2">{r.descripcion?.slice(0, 100)}{r.descripcion?.length > 100 ? "..." : ""}</div>
              <div className="text-gray-400 text-[9px] font-bold uppercase tracking-widest text-right">
                {new Date(r.created_at).toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })} — {new Date(r.created_at).toLocaleDateString("es-AR")}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
