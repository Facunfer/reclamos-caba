// src/components/ui/PanelSugerenciasFilters.tsx
"use client";

import { useRouter } from "next/navigation";

interface Props {
    current: Record<string, string | undefined>;
    tipos: { id: number, nombre: string }[];
}

export default function PanelSugerenciasFilters({ current, tipos }: Props) {
    const router = useRouter();
    const urgencias = ["BAJA", "MEDIA", "ALTA"];

    function updateUrl(key: string, value: string | null) {
        const p = new URLSearchParams(current as Record<string, string>);
        if (!value || p.get(key) === value) {
            p.delete(key);
        } else {
            p.set(key, value);
        }
        p.delete("page");
        router.push(`/panel/sugerencias?${p.toString()}`);
    }

    function urgenciaActive(u: string) {
        if (u === "ALTA") return "bg-red-600 text-white border-red-600";
        if (u === "MEDIA") return "bg-yellow-500 text-white border-yellow-500";
        return "bg-green-600 text-white border-green-600";
    }

    return (
        <div className="flex flex-col gap-4 mb-6 lla-card p-4">
            <div className="flex flex-wrap items-center gap-4">
                {/* Urgencia Filters */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Importancia:</span>
                    <div className="flex gap-1.5">
                        {urgencias.map((u) => (
                            <button
                                key={u}
                                onClick={() => {
                                    updateUrl("urgencia", u);
                                }}
                                className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition ${current.urgencia === u
                                    ? urgenciaActive(u)
                                    : "bg-black/20 text-muted border-white/10 hover:border-primary/50"
                                    }`}
                            >
                                {u}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tipo Filter */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Categoría:</span>
                    <select
                        className="lla-input py-1 px-3 text-[10px] font-bold uppercase tracking-wider min-w-[150px] cursor-pointer"
                        value={current.tipo || ""}
                        onChange={(e) => updateUrl("tipo", e.target.value || null)}
                    >
                        <option value="">TODAS LAS CAT.</option>
                        {tipos.map((t) => (
                            <option key={t.id} value={t.nombre}>{t.nombre}</option>
                        ))}
                    </select>
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-2 ml-auto">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Fecha:</span>
                    <div className="flex items-center gap-1">
                        <input
                            type="date"
                            className="lla-input py-1 px-2 text-[10px] font-bold w-32 cursor-pointer"
                            value={current.desde || ""}
                            onChange={(e) => updateUrl("desde", e.target.value || null)}
                        />
                        <span className="text-muted text-[10px]">→</span>
                        <input
                            type="date"
                            className="lla-input py-1 px-2 text-[10px] font-bold w-32 cursor-pointer"
                            value={current.hasta || ""}
                            onChange={(e) => updateUrl("hasta", e.target.value || null)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
