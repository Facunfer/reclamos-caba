// src/components/charts/Charts.tsx
"use client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from "recharts";
import type { BarrasTipo, LineaDia } from "@/types";

interface Props {
  barras: BarrasTipo[];
  linea: LineaDia[];
}

export default function Charts({ barras, linea }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="lla-card p-6">
        <h2 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-6 ml-2">Distribución por Tipo</h2>
        {barras.length === 0 ? (
          <div className="text-muted text-xs py-12 text-center uppercase font-bold">Sin datos para mostrar</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barras} margin={{ top: 10, right: 10, bottom: 60, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis
                dataKey="tipo_reclamo"
                tick={{ fontSize: 9, fill: "#71717a", fontWeight: "bold" }}
                angle={-45}
                textAnchor="end"
                interval={0}
                stroke="#333"
              />
              <YAxis tick={{ fontSize: 9, fill: "#71717a" }} allowDecimals={false} stroke="#333" />
              <Tooltip
                contentStyle={{ backgroundColor: "#000", border: "1px solid #222", borderRadius: "8px", fontSize: "11px" }}
                itemStyle={{ color: "#7c3aed" }}
                cursor={{ fill: "rgba(124, 58, 237, 0.05)" }}
              />
              <Bar dataKey="total" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="lla-card p-6">
        <h2 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-6 ml-2">Evolución Temporal</h2>
        {linea.length === 0 ? (
          <div className="text-muted text-xs py-12 text-center uppercase font-bold">Sin datos para mostrar</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={linea} margin={{ top: 10, right: 20, bottom: 60, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis
                dataKey="fecha"
                tick={{ fontSize: 9, fill: "#71717a", fontWeight: "bold" }}
                angle={-45}
                textAnchor="end"
                interval="preserveStartEnd"
                stroke="#333"
              />
              <YAxis tick={{ fontSize: 9, fill: "#71717a" }} allowDecimals={false} stroke="#333" />
              <Tooltip
                contentStyle={{ backgroundColor: "#000", border: "1px solid #222", borderRadius: "8px", fontSize: "11px" }}
                itemStyle={{ color: "#7c3aed" }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#7c3aed"
                strokeWidth={3}
                dot={{ fill: "#7c3aed", strokeWidth: 2, r: 4, stroke: "#000" }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
