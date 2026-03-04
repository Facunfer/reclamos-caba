// src/components/ui/SugerenciasTable.tsx
"use client";
import type { Sugerencia } from "@/types";

const URGENCIA_COLORS: Record<string, string> = {
    ALTA: "bg-red-950/40 text-red-500 border border-red-900/40",
    MEDIA: "bg-yellow-950/40 text-yellow-500 border border-yellow-900/40",
    BAJA: "bg-green-950/40 text-green-500 border border-green-900/40",
};

export default function SugerenciasTable({ sugerencias }: { sugerencias: Sugerencia[] }) {
    if (!sugerencias.length) {
        return (
            <div className="lla-card text-center text-muted py-16">
                No hay sugerencias aún. <a href="/panel/sugerencias/nuevo" className="text-primary hover:underline font-bold">Crear la primera</a>
            </div>
        );
    }

    return (
        <div className="lla-card overflow-x-auto">
            <table className="min-w-full text-xs">
                <thead>
                    <tr className="bg-black/40 text-left text-[10px] text-muted uppercase tracking-[0.2em] font-bold border-b border-card-border">
                        <th className="px-6 py-4">Fecha</th>
                        <th className="px-6 py-4">Categoría</th>
                        <th className="px-6 py-4">Importancia</th>
                        <th className="px-6 py-4">Dirección (Opcional)</th>
                        <th className="px-6 py-4">Geo</th>
                        <th className="px-6 py-4">Contacto</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                    {sugerencias.map((s) => (
                        <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-5 whitespace-nowrap text-muted font-medium">
                                {new Date(s.created_at).toLocaleDateString("es-AR")}
                            </td>
                            <td className="px-6 py-5 font-bold text-white">{s.tipo_sugerencia}</td>
                            <td className="px-6 py-5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${URGENCIA_COLORS[s.urgencia]}`}>
                                    {s.urgencia}
                                </span>
                            </td>
                            <td className="px-6 py-5 max-w-xs truncate text-muted">{s.direccion_normalizada ?? s.direccion_raw ?? "-"}</td>
                            <td className="px-6 py-5 text-center">
                                {s.lat && s.lng ? (
                                    <span className="text-primary text-base">●</span>
                                ) : (
                                    <span className="text-muted text-xs">-</span>
                                )}
                            </td>
                            <td className="px-6 py-5">
                                <div className="text-[10px] uppercase font-bold tracking-tight">
                                    <div className="text-white">{s.nombre_contacto || "-"}</div>
                                    <div className="text-muted">{s.telefono_contacto || "-"}</div>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
