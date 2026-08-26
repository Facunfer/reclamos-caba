// src/components/charts/Charts.tsx
"use client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";
import type { BarrasTipoApilada, LineaDia } from "@/types";
import { COLOR_ORIGEN, LABEL_ORIGEN } from "@/lib/paletaTipos";

interface Props {
  barras: BarrasTipoApilada[];
  linea: LineaDia[];
  /**
   * Apilar las barras por origen (dashboard de reclamos, con dos fuentes).
   * En false se dibuja una sola serie con el color del slot 1 y sin leyenda
   * — el título ya la nombra (dashboard de sugerencias, fuente única).
   */
  apiladoPorOrigen?: boolean;
}

// Superficie del dashboard: negro. El separador de 2px entre segmentos
// apilados se pinta del color de la superficie, no con un borde.
const SURFACE = "#000000";
const GRID = "#222222";
const AXIS = "#333333";
const INK_MUTED = "#71717a";

const tooltipStyle = {
  backgroundColor: "#000",
  border: "1px solid #222",
  borderRadius: "8px",
  fontSize: "11px",
} as const;

export default function Charts({ barras, linea, apiladoPorOrigen = true }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="lla-card p-6">
        <h2 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-6 ml-2">
          Distribución por Tipo
        </h2>
        {barras.length === 0 ? (
          <div className="text-muted text-xs py-12 text-center uppercase font-bold">Sin datos para mostrar</div>
        ) : (
          <ResponsiveContainer width="100%" height={apiladoPorOrigen ? 330 : 300}>
            <BarChart
              data={barras}
              margin={{ top: apiladoPorOrigen ? 28 : 10, right: 10, bottom: 70, left: -20 }}
            >
              <CartesianGrid strokeDasharray="0" stroke={GRID} vertical={false} />
              <XAxis
                dataKey="tipo"
                tick={{ fontSize: 9, fill: INK_MUTED, fontWeight: "bold" }}
                angle={-45}
                textAnchor="end"
                interval={0}
                stroke={AXIS}
              />
              <YAxis tick={{ fontSize: 9, fill: INK_MUTED }} allowDecimals={false} stroke={AXIS} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              {apiladoPorOrigen && (
                // Arriba del área de plot, no abajo: ahí abajo ya está el
                // espacio de las 14 etiquetas del eje X rotadas -45°, y una
                // leyenda ahí se superponía con ellas.
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={28}
                  wrapperStyle={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}
                  iconType="circle"
                  iconSize={8}
                />
              )}
              {apiladoPorOrigen ? (
                // 2px de separación entre segmentos, pintados con el color de
                // la superficie (no un borde alrededor de la marca).
                [
                  <Bar
                    key="mapa"
                    dataKey="mapa"
                    name={LABEL_ORIGEN.mapa}
                    stackId="origen"
                    fill={COLOR_ORIGEN.mapa}
                    stroke={SURFACE}
                    strokeWidth={2}
                  />,
                  <Bar
                    key="mtr"
                    dataKey="mtr"
                    name={LABEL_ORIGEN.mtr}
                    stackId="origen"
                    fill={COLOR_ORIGEN.mtr}
                    stroke={SURFACE}
                    strokeWidth={2}
                    radius={[4, 4, 0, 0]}
                  />,
                ]
              ) : (
                <Bar dataKey="total" name="Total" fill={COLOR_ORIGEN.mapa} radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="lla-card p-6">
        <h2 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-6 ml-2">
          Evolución Temporal
        </h2>
        {linea.length === 0 ? (
          <div className="text-muted text-xs py-12 text-center uppercase font-bold">Sin datos para mostrar</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            {/* Una sola serie (total diario): sin leyenda — el título la nombra. */}
            <LineChart data={linea} margin={{ top: 10, right: 20, bottom: 70, left: -20 }}>
              <CartesianGrid strokeDasharray="0" stroke={GRID} vertical={false} />
              <XAxis
                dataKey="fecha"
                tick={{ fontSize: 9, fill: INK_MUTED, fontWeight: "bold" }}
                angle={-45}
                textAnchor="end"
                interval="preserveStartEnd"
                stroke={AXIS}
              />
              <YAxis tick={{ fontSize: 9, fill: INK_MUTED }} allowDecimals={false} stroke={AXIS} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="total"
                name="Reclamos"
                stroke={COLOR_ORIGEN.mapa}
                strokeWidth={2}
                dot={{ fill: COLOR_ORIGEN.mapa, strokeWidth: 2, r: 4, stroke: SURFACE }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: SURFACE }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
