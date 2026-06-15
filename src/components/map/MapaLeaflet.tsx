// src/components/map/MapaLeaflet.tsx
"use client";
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, CircleMarker, Polyline, Polygon } from "react-leaflet";
import L from "leaflet";
import type { ReclamoPublico } from "@/types";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = (Math.abs(hash) * 0.618033988749895) % 1;
  return `hsl(${Math.floor(h * 360)}, 75%, 45%)`;
}

function makeIcon(tipo: string) {
  const color = stringToColor(tipo);
  return L.divIcon({
    className: "",
    html: `<div style="width:22px;height:22px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}

const URGENCIA_LABEL: Record<string, string> = {
  ALTA: "🔴 ALTA", MEDIA: "🟡 MEDIA", BAJA: "🟢 BAJA",
};

const CABA_CENTER: [number, number] = [-34.6037, -58.3816];

interface Props {
  reclamos: ReclamoPublico[];
  drawingMode?: boolean;
  drawingPoints?: [number, number][];
  activePolygon?: [number, number][] | null;
  onAddPoint?: (lat: number, lng: number) => void;
}

function FitBounds({ reclamos }: { reclamos: ReclamoPublico[] }) {
  const map = useMap();
  useEffect(() => {
    const points = reclamos.filter(r => r.lat && r.lng);
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points.map(r => [r.lat!, r.lng!])), { padding: [30, 30] });
    }
  }, [reclamos, map]);
  return null;
}

function DrawingHandler({ drawingMode, onAddPoint }: { drawingMode?: boolean; onAddPoint?: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click(e) {
      if (drawingMode && onAddPoint) {
        onAddPoint(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  useEffect(() => {
    map.getContainer().style.cursor = drawingMode ? "crosshair" : "";
    if (drawingMode) {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }
  }, [drawingMode, map]);

  return null;
}

export default function MapaLeaflet({ reclamos, drawingMode, drawingPoints = [], activePolygon, onAddPoint }: Props) {
  const withGeo = useMemo(() => reclamos.filter(r => r.lat && r.lng), [reclamos]);

  return (
    <MapContainer center={CABA_CENTER} zoom={13} style={{ height: "100%", width: "100%" }} className="z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds reclamos={withGeo} />
      <DrawingHandler drawingMode={drawingMode} onAddPoint={onAddPoint} />

      {/* Polígono siendo dibujado */}
      {drawingMode && drawingPoints.length > 0 && (
        <>
          {drawingPoints.map((p, i) => (
            <CircleMarker key={i} center={p} radius={5} pathOptions={{ color: "#6366f1", fillColor: "#6366f1", fillOpacity: 1 }} />
          ))}
          {drawingPoints.length > 1 && (
            <Polyline positions={drawingPoints} pathOptions={{ color: "#6366f1", dashArray: "6 4", weight: 2 }} />
          )}
        </>
      )}

      {/* Polígono activo (filtro confirmado) */}
      {!drawingMode && activePolygon && activePolygon.length > 2 && (
        <Polygon positions={activePolygon} pathOptions={{ color: "#6366f1", fillColor: "#6366f1", fillOpacity: 0.1, weight: 2 }} />
      )}

      {/* Markers */}
      {withGeo.map(r => (
        <Marker key={r.id} position={[r.lat!, r.lng!]} icon={makeIcon(r.tipo_reclamo)}>
          {!drawingMode && (
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

                {r.reclamo_archivos && r.reclamo_archivos.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Archivos adjuntos</div>
                    <div className="flex flex-wrap gap-2">
                      {r.reclamo_archivos.map(file => {
                        const isImage = file.tipo === "foto" || file.storage_path.match(/\.(jpg|jpeg|png|webp|gif)$/i);
                        const isSugerencia = "tipo_sugerencia" in r;
                        const bucket = isSugerencia ? "reclamos-documentos" : "reclamos-fotos";
                        const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
                        const url = `${baseUrl}/storage/v1/object/public/${bucket}/${file.storage_path}`;
                        return (
                          <a key={file.id} href={url} target="_blank" rel="noreferrer" className="block w-12 h-12 border border-gray-100 rounded overflow-hidden hover:border-primary transition-colors">
                            {isImage ? <img src={url} alt="adjunto" className="w-full h-full object-cover" /> : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-50 text-xl">
                                {file.tipo === "pdf" ? "📕" : "📄"}
                              </div>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(r.creador_nombre || r.creador_email) && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Cargado por · Comuna {String(r.comuna_id).padStart(2, "0")}
                    </div>
                    {r.creador_nombre && <div className="text-[11px] font-bold text-gray-800">{r.creador_nombre}</div>}
                    {r.creador_email && <div className="text-[10px] text-gray-500">{r.creador_email}</div>}
                    {r.creador_telefono && <div className="text-[10px] text-gray-500">{r.creador_telefono}</div>}
                  </div>
                )}

                <div className="text-gray-400 text-[9px] font-bold uppercase tracking-widest text-right mt-2">
                  {new Date(r.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} — {new Date(r.created_at).toLocaleDateString("es-AR")}
                </div>
              </div>
            </Popup>
          )}
        </Marker>
      ))}
    </MapContainer>
  );
}
