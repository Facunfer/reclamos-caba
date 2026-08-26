// src/components/map/MapaLeaflet.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, CircleMarker, Polyline, Polygon } from "react-leaflet";
import L from "leaflet";
import type { ReclamoUnificado, OrigenReclamo } from "@/types";
import { colorDeTipo } from "@/lib/paletaTipos";
import { urlDeArchivo } from "@/lib/archivoUrl";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// El color codifica el TIPO (paleta documentada y medida en @/lib/paletaTipos).
// El ORIGEN va por un canal visual secundario — el anillo del marcador:
// sólido = cargado en el mapa, punteado = Mandame Tu Reclamo.
function makeIcon(tipo: string, origen: OrigenReclamo) {
  const color = colorDeTipo(tipo);
  const ring =
    origen === "mtr"
      ? "border:2px dashed #ffffff;"
      : "border:2px solid #ffffff;";
  return L.divIcon({
    className: "",
    html: `<div style="width:22px;height:22px;background:${color};${ring}border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}

/**
 * Leyenda del mapa. Es una MITIGACIÓN OBLIGATORIA, no decoración: con 14
 * categorías hay pares de color que no se distinguen entre sí (ver la nota
 * de medición en @/lib/paletaTipos). Solo lista los tipos presentes en el
 * dataset visible, para no mostrar categorías vacías.
 */
function Leyenda({ tiposPresentes }: { tiposPresentes: string[] }) {
  const [abierta, setAbierta] = useState(true);
  if (tiposPresentes.length === 0) return null;

  return (
    <div className="absolute bottom-4 right-3 z-[1000] max-w-[230px] bg-black/85 border border-white/15 rounded shadow-xl backdrop-blur-sm">
      <button
        onClick={() => setAbierta((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[9px] font-black text-white/70 uppercase tracking-widest hover:text-white transition-colors"
      >
        <span>Referencias ({tiposPresentes.length})</span>
        <span>{abierta ? "▾" : "▸"}</span>
      </button>
      {abierta && (
        <div className="px-3 pb-3 max-h-[220px] overflow-y-auto">
          <ul className="space-y-1">
            {tiposPresentes.map((tipo) => (
              <li key={tipo} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/60"
                  style={{ background: colorDeTipo(tipo) }}
                />
                <span className="text-[9px] text-white/85 leading-tight">{tipo}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-white/25 border-2 border-white" />
              <span className="text-[9px] text-white/70 leading-tight">Cargado en el mapa</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-white/25 border-2 border-dashed border-white" />
              <span className="text-[9px] text-white/70 leading-tight">Mandame Tu Reclamo</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const URGENCIA_LABEL: Record<string, string> = {
  ALTA: "🔴 ALTA", MEDIA: "🟡 MEDIA", BAJA: "🟢 BAJA",
};

const CABA_CENTER: [number, number] = [-34.6037, -58.3816];

interface Props {
  reclamos: ReclamoUnificado[];
  drawingMode?: boolean;
  drawingPoints?: [number, number][];
  activePolygon?: [number, number][] | null;
  onAddPoint?: (lat: number, lng: number) => void;
}

function FitBounds({ reclamos }: { reclamos: ReclamoUnificado[] }) {
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
  const tiposPresentes = useMemo(
    () => Array.from(new Set(withGeo.map(r => r.tipo))).sort((a, b) => a.localeCompare(b, "es")),
    [withGeo]
  );

  return (
    <>
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
        <Marker key={r.id} position={[r.lat!, r.lng!]} icon={makeIcon(r.tipo, r.origen)}>
          {!drawingMode && (
            <Popup className="lla-popup-light">
              <div className="text-[11px] min-w-[200px] p-1">
                <div className="font-black text-primary uppercase tracking-widest mb-1 border-b border-gray-100 pb-1">{r.tipo}</div>
                {r.subtipo && (
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tight mb-2">{r.subtipo}</div>
                )}
                <div className="mb-1 flex justify-between">
                  <span className="text-gray-400 font-bold uppercase tracking-tighter">Origen</span>
                  <span className="font-black">{r.origen === "mapa" ? "Mapa" : "Mandame Tu Reclamo"}</span>
                </div>
                <div className="mb-1 flex justify-between">
                  <span className="text-gray-400 font-bold uppercase tracking-tighter">Urgencia</span>
                  <span className="font-black">{r.urgencia ? URGENCIA_LABEL[r.urgencia] : "— Sin dato"}</span>
                </div>
                <div className="mb-3 flex justify-between">
                  <span className="text-gray-400 font-bold uppercase tracking-tighter">Comuna</span>
                  <span className="font-black">{r.comuna != null ? String(r.comuna).padStart(2, "0") : "—"}</span>
                </div>
                <div className="mb-2 text-gray-800 font-medium leading-tight">{r.direccion}</div>
                <div className="text-gray-500 italic mb-3 leading-relaxed border-l-2 border-primary pl-2">{r.descripcion?.slice(0, 100)}{(r.descripcion?.length ?? 0) > 100 ? "..." : ""}</div>

                {r.archivos.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Archivos adjuntos</div>
                    <div className="flex flex-wrap gap-2">
                      {r.archivos.map(file => {
                        const isImage = file.tipo === "foto" || file.storage_path.match(/\.(jpg|jpeg|png|webp|gif)$/i);
                        const url = urlDeArchivo(r.origen, file);
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

                {(r.nombre_contacto || r.telefono || r.email || r.dni) && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Contacto</div>
                    {r.nombre_contacto && <div className="text-[11px] font-bold text-gray-800">{r.nombre_contacto}</div>}
                    {r.dni && <div className="text-[10px] text-gray-500">DNI {r.dni}</div>}
                    {r.telefono && <div className="text-[10px] text-gray-500">{r.telefono}</div>}
                    {r.email && <div className="text-[10px] text-gray-500">{r.email}</div>}
                  </div>
                )}

                {(r.creador_nombre || r.creador_email) && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Cargado por{r.comuna != null ? ` · Comuna ${String(r.comuna).padStart(2, "0")}` : ""}
                    </div>
                    {r.creador_nombre && <div className="text-[11px] font-bold text-gray-800">{r.creador_nombre}</div>}
                    {r.creador_email && <div className="text-[10px] text-gray-500">{r.creador_email}</div>}
                    {r.creador_telefono && <div className="text-[10px] text-gray-500">{r.creador_telefono}</div>}
                  </div>
                )}

                <div className="text-gray-400 text-[9px] font-bold uppercase tracking-widest text-right mt-2">
                  {new Date(r.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} — {new Date(r.fecha).toLocaleDateString("es-AR")}
                </div>
              </div>
            </Popup>
          )}
        </Marker>
      ))}
    </MapContainer>
    {!drawingMode && <Leyenda tiposPresentes={tiposPresentes} />}
    </>
  );
}
