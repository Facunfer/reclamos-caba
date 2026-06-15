// src/components/CircuitosPanelClient.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { CircuitoFeatureProps, ProblemaCircuito, TipoProblemaCircuito, Urgencia } from "@/types";

const MapaCircuitos = dynamic(() => import("@/components/map/MapaCircuitos"), { ssr: false });

const URGENCIAS: Urgencia[] = ["BAJA", "MEDIA", "ALTA"];

const URGENCIA_BADGE: Record<string, string> = {
  ALTA: "bg-red-950/40 text-red-500 border border-red-900/40",
  MEDIA: "bg-yellow-950/40 text-yellow-500 border border-yellow-900/40",
  BAJA: "bg-green-950/40 text-green-500 border border-green-900/40",
};

interface Props {
  comunaId: number;
  userId: string;
  tipos: TipoProblemaCircuito[];
}

export default function CircuitosPanelClient({ comunaId, userId, tipos }: Props) {
  const [geojson, setGeojson] = useState<any | null>(null);
  const [selected, setSelected] = useState<CircuitoFeatureProps | null>(null);
  const [problemas, setProblemas] = useState<ProblemaCircuito[]>([]);
  const [loadingProblemas, setLoadingProblemas] = useState(false);

  const [pickMode, setPickMode] = useState(false);
  const [pickedPoint, setPickedPoint] = useState<[number, number] | null>(null);

  const [form, setForm] = useState({
    tipo: tipos[0]?.nombre ?? "",
    urgencia: "MEDIA" as Urgencia,
    descripcion: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Cargar polígonos de la comuna del usuario
  useEffect(() => {
    fetch(`/api/circuitos?comuna_id=${comunaId}`)
      .then((r) => r.json())
      .then(setGeojson)
      .catch((e) => console.error("[circuitos] error cargando geojson:", e));
  }, [comunaId]);

  const loadProblemas = useCallback(async (circuitoId: number) => {
    setLoadingProblemas(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("problemas_circuito")
      .select("*")
      .eq("circuito_id", circuitoId)
      .order("created_at", { ascending: false });
    if (error) console.error("[circuitos] error cargando problemas:", error);
    setProblemas((data as ProblemaCircuito[]) ?? []);
    setLoadingProblemas(false);
  }, []);

  function handleSelect(props: CircuitoFeatureProps) {
    setSelected(props);
    setPickMode(false);
    setPickedPoint(null);
    setError("");
    setSuccess("");
    loadProblemas(props.id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setSuccess("");
    if (!form.descripcion.trim()) {
      setError("La descripción es obligatoria.");
      return;
    }
    setSaving(true);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("problemas_circuito").insert({
      circuito_id: selected.id,
      comuna_id: comunaId,
      tipo: form.tipo,
      urgencia: form.urgencia,
      descripcion: form.descripcion.trim(),
      estado: "nuevo",
      lat: pickedPoint ? pickedPoint[0] : null,
      lng: pickedPoint ? pickedPoint[1] : null,
      creado_por_user_id: userId,
    });

    setSaving(false);
    if (insertError) {
      setError("Error al guardar: " + insertError.message);
      return;
    }
    setSuccess("Problema cargado correctamente.");
    setForm({ tipo: tipos[0]?.nombre ?? "", urgencia: "MEDIA", descripcion: "" });
    setPickedPoint(null);
    setPickMode(false);
    loadProblemas(selected.id);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Mapa */}
      <div className="lg:col-span-2 relative border border-card-border rounded-lg overflow-hidden h-[600px]">
        <MapaCircuitos
          geojson={geojson}
          selectedId={selected?.id ?? null}
          onSelectCircuito={handleSelect}
          problemas={problemas.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, urgencia: p.urgencia, tipo: p.tipo }))}
          pickMode={pickMode}
          pickedPoint={pickedPoint}
          onPickPoint={(lat, lng) => { setPickedPoint([lat, lng]); setPickMode(false); }}
        />
        {pickMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-black/80 border border-indigo-500/60 text-indigo-300 text-[11px] font-bold uppercase tracking-widest px-4 py-2 rounded-full shadow-xl pointer-events-none">
            Hacé clic dentro del circuito para ubicar el problema
          </div>
        )}
      </div>

      {/* Panel lateral */}
      <div className="lla-card p-5 h-[600px] overflow-y-auto">
        {!selected ? (
          <div className="text-center text-muted py-16 text-xs uppercase tracking-widest font-bold">
            Seleccioná un circuito en el mapa para ver y cargar problemas.
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-black text-white">Circuito {selected.codigo}</h2>
              {selected.barrio && <p className="text-muted text-xs">{selected.barrio}</p>}
            </div>

            {/* Form nuevo problema */}
            <form onSubmit={handleSubmit} className="space-y-4 border-t border-card-border pt-4">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">Cargar problema</p>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                  className="lla-input w-full px-3 py-2 text-xs focus:outline-none"
                >
                  {tipos.map((t) => (
                    <option key={t.id} value={t.nombre} className="bg-black text-white">{t.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest">Urgencia</label>
                <div className="flex gap-2">
                  {URGENCIAS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, urgencia: u }))}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-tighter transition-all ${
                        form.urgencia === u ? urgenciaStyle(u) : "bg-black border border-card-border text-muted hover:border-muted/50"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest">Descripción</label>
                <textarea
                  rows={3}
                  value={form.descripcion}
                  onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Describí el problema..."
                  className="lla-input w-full px-3 py-2 text-xs focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setPickMode((v) => !v); }}
                  className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded border transition-colors ${
                    pickMode ? "bg-indigo-600 text-white border-indigo-600" : "border-card-border text-muted hover:text-white"
                  }`}
                >
                  {pickedPoint ? "Ubicación fijada ✓" : pickMode ? "Cancelar ubicación" : "📍 Ubicar en mapa"}
                </button>
                {pickedPoint && (
                  <button type="button" onClick={() => setPickedPoint(null)} className="text-[10px] text-muted hover:text-red-400 uppercase font-bold tracking-widest">
                    Quitar
                  </button>
                )}
              </div>

              {error && <p className="text-red-400 text-[11px] font-bold">{error}</p>}
              {success && <p className="text-green-400 text-[11px] font-bold">{success}</p>}

              <button
                type="submit"
                disabled={saving}
                className={`w-full py-3 uppercase tracking-[0.2em] text-[10px] font-black transition-all ${
                  saving ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : "lla-btn-primary"
                }`}
              >
                {saving ? "Guardando..." : "Cargar problema"}
              </button>
            </form>

            {/* Lista de problemas */}
            <div className="border-t border-card-border pt-4">
              <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-3">
                Problemas cargados ({problemas.length})
              </p>
              {loadingProblemas ? (
                <p className="text-muted text-xs animate-pulse">Cargando...</p>
              ) : problemas.length === 0 ? (
                <p className="text-muted/60 text-xs">Sin problemas en este circuito.</p>
              ) : (
                <ul className="space-y-2">
                  {problemas.map((p) => (
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
          </div>
        )}
      </div>
    </div>
  );
}

function urgenciaStyle(u: string) {
  if (u === "ALTA") return "bg-red-600 text-white border-red-600";
  if (u === "MEDIA") return "bg-yellow-500 text-white border-yellow-500";
  return "bg-green-600 text-white border-green-600";
}
