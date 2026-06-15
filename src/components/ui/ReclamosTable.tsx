// src/components/ui/ReclamosTable.tsx
"use client";
import type { Reclamo } from "@/types";

const URGENCIA_COLORS: Record<string, string> = {
  ALTA: "bg-red-950/40 text-red-500 border border-red-900/40",
  MEDIA: "bg-yellow-950/40 text-yellow-500 border border-yellow-900/40",
  BAJA: "bg-green-950/40 text-green-500 border border-green-900/40",
};

export default function ReclamosTable({ reclamos }: { reclamos: Reclamo[] }) {
  if (!reclamos.length) {
    return (
      <div className="lla-card text-center text-muted py-16">
        No hay reclamos aún. <a href="/panel/nuevo" className="text-primary hover:underline font-bold">Crear el primero</a>
      </div>
    );
  }

  return (
    <div className="lla-card overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-black/40 text-left text-[10px] text-muted uppercase tracking-[0.2em] font-bold border-b border-card-border">
            <th className="px-6 py-4">Fecha</th>
            <th className="px-6 py-4">Tipo</th>
            <th className="px-6 py-4">Urgencia</th>
            <th className="px-6 py-4">Dirección</th>
            <th className="px-6 py-4">Geo</th>
            <th className="px-6 py-4">Archivos</th>
            <th className="px-6 py-4">Contacto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-card-border">
          {reclamos.map((r) => (
            <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
              <td className="px-6 py-5 whitespace-nowrap text-muted font-medium">
                {new Date(r.created_at).toLocaleDateString("es-AR")}
              </td>
              <td className="px-6 py-5 font-bold text-white">{r.tipo_reclamo}</td>
              <td className="px-6 py-5">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${URGENCIA_COLORS[r.urgencia]}`}>
                  {r.urgencia}
                </span>
              </td>
              <td className="px-6 py-5 max-w-xs truncate text-muted">{r.direccion_normalizada ?? r.direccion_raw}</td>
              <td className="px-6 py-5 text-center">
                {r.lat && r.lng ? (
                  <span className="text-primary text-base">●</span>
                ) : (
                  <span className="text-red-900/50 text-xs">ERR</span>
                )}
              </td>
              <td className="px-6 py-5">
                {r.reclamo_archivos && r.reclamo_archivos.length > 0 ? (
                  <div className="flex gap-1 flex-wrap">
                    {r.reclamo_archivos.map((file, idx) => (
                      <a
                        key={file.id}
                        href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/reclamos-fotos/${file.storage_path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-5 h-5 flex items-center justify-center bg-indigo-900/50 text-indigo-400 rounded hover:bg-indigo-700 hover:text-white transition-colors border border-indigo-700/50"
                        title="Ver archivo"
                      >
                         {file.tipo === 'foto' ? '🖼️' : '📄'}
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted/30">-</span>
                )}
              </td>
              <td className="px-6 py-5">
                <div className="text-[10px] uppercase font-bold tracking-tight">
                  <div className="text-white">{r.nombre_contacto || "-"}</div>
                  <div className="text-muted">{r.telefono_contacto || "-"}</div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
