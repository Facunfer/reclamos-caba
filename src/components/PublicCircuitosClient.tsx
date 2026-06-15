// src/components/PublicCircuitosClient.tsx
"use client";
import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type { CircuitoFeatureProps, ProblemaCircuitoPublico } from "@/types";

const MapaCircuitos = dynamic(() => import("@/components/map/MapaCircuitos"), { ssr: false });

const URGENCIA_BADGE: Record<string, string> = {
  ALTA: "bg-red-950/40 text-red-500 border border-red-900/40",
  MEDIA: "bg-yellow-950/40 text-yellow-500 border border-yellow-900/40",
  BAJA: "bg-green-950/40 text-green-500 border border-green-900/40",
};

interface Props {
  geojson: any;
  problemas: ProblemaCircuitoPublico[];
}

export default function PublicCircuitosClient({ geojson, problemas }: Props) {
  const [selected, setSelected] = useState<CircuitoFeatureProps | null>(null);

  // Conteo de problemas por circuito (para colorear el mapa)
  const countsByCircuito = useMemo(() => {
    const m: Record<number, number> = {};
    for (const p of problemas) m[p.circuito_id] = (m[p.circuito_id] ?? 0) + 1;
    return m;
  }, [problemas]);

  const problemasDelCircuito = useMemo(
    () => (selected ? problemas.filter((p) => p.circuito_id === selected.id) : []),
    [selected, problemas]
  );

  return (
    <div className="flex flex-col flex-1 bg-black">
      <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
        <h2 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
          Problemas por <span className="text-white">Circuito Electoral</span>
        </h2>
        <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded font-black uppercase tracking-tighter">
          {problemas.length} problemas · {geojson?.features?.length ?? 0} circuitos
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        <div className="lg:col-span-2 relative border border-card-border rounded-lg overflow-hidden h-[600px]">
          <MapaCircuitos
            geojson={geojson}
            selectedId={selected?.id ?? null}
            onSelectCircuito={setSelected}
            countsByCircuito={countsByCircuito}
            problemas={problemasDelCircuito.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, urgencia: p.urgencia, tipo: p.tipo }))}
          />
        </div>

        <div className="lla-card p-5 h-[600px] overflow-y-auto">
          {!selected ? (
            <div className="text-center text-muted py-16 text-xs uppercase tracking-widest font-bold">
              Seleccioná un circuito para ver sus problemas.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-white">Circuito {selected.codigo}</h3>
                <p className="text-muted text-xs">
                  {selected.barrio ? `${selected.barrio} · ` : ""}Comuna {String(selected.comuna_id).padStart(2, "0")}
                </p>
              </div>
              <p className="text-[10px] font-black text-muted uppercase tracking-widest">
                {problemasDelCircuito.length} problema{problemasDelCircuito.length !== 1 ? "s" : ""}
              </p>
              {problemasDelCircuito.length === 0 ? (
                <p className="text-muted/60 text-xs">Sin problemas cargados en este circuito.</p>
              ) : (
                <ul className="space-y-2">
                  {problemasDelCircuito.map((p) => (
                    <li key={p.id} className="bg-black/40 border border-card-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white">{p.tipo}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${URGENCIA_BADGE[p.urgencia]}`}>
                          {p.urgencia}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted leading-tight">{p.descripcion}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[9px] text-muted/60 uppercase tracking-widest">{p.estado}</span>
                        <span className="text-[9px] text-muted/60">{new Date(p.created_at).toLocaleDateString("es-AR")}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
