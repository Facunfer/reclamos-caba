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
                <div className="flex w-full items-center gap-2 md:w-auto">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Importancia:</span>
                    <div className="flex gap-1.5">
                        {urgencias.map((u) => (
                            <button
                                key={u}
                                onClick={() => {
                                    updateUrl("urgencia", u);
                                }}
                                // 44px en teléfono, el chip chico de siempre en
                                // escritorio. Los chips medían 24px de alto: es
                                // menos de la mitad del mínimo táctil cómodo, y
                                // están pegados de a tres, así que fallarlos
                                // aplicaba el filtro de al lado.
                                className={`flex min-h-11 items-center rounded px-4 text-[10px] font-bold uppercase tracking-wider border transition md:min-h-0 md:px-3 md:py-1 ${current.urgencia === u
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
                <div className="flex w-full items-center gap-2 md:w-auto">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Categoría:</span>
                    <select
                        className="lla-input min-h-11 px-3 text-[10px] font-bold uppercase tracking-wider min-w-0 flex-1 cursor-pointer md:flex-none md:min-w-[150px] md:min-h-0 md:py-1"
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
                {/* `ml-auto` solo en escritorio: en teléfono los bloques se apilan y
                    empujar el último a la derecha deja un hueco raro en el medio. */}
                <div className="flex w-full items-center gap-2 md:w-auto md:ml-auto">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Fecha:</span>
                    <div className="flex min-w-0 flex-1 items-center gap-1 md:flex-none">
                        <input
                            type="date"
                            className="lla-input min-h-11 w-full min-w-0 px-2 text-[10px] font-bold cursor-pointer md:min-h-0 md:w-32 md:py-1"
                            value={current.desde || ""}
                            onChange={(e) => updateUrl("desde", e.target.value || null)}
                        />
                        <span className="text-muted text-[10px]">→</span>
                        <input
                            type="date"
                            className="lla-input min-h-11 w-full min-w-0 px-2 text-[10px] font-bold cursor-pointer md:min-h-0 md:w-32 md:py-1"
                            value={current.hasta || ""}
                            onChange={(e) => updateUrl("hasta", e.target.value || null)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
