"use client";

import { useEffect, useState } from "react";

/** El mismo corte que usa `md:` en Tailwind. Si cambia allá, cambia acá. */
export const CONSULTA_ESCRITORIO = "(min-width: 768px)";

/**
 * `true` cuando la pantalla es de escritorio. Sirve para NO MONTAR componentes
 * caros en el teléfono, que es distinto de esconderlos con CSS.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cuándo usar esto y cuándo usar `md:hidden`
 * ─────────────────────────────────────────────────────────────────────────
 * Por defecto, esconder con clases: es más simple, funciona sin JavaScript y el
 * HTML del servidor ya sale bien para los dos anchos, sin parpadeo al hidratar.
 * Así están las tarjetas del panel y la barra de filtros.
 *
 * Esto es la excepción, y en esta app es para una sola cosa: **Leaflet**. El
 * mapa de circuitos ya se importa con `next/dynamic({ ssr: false })`, pero eso
 * solo evita el render en el servidor — el chunk se descarga igual apenas se
 * monta el componente. Un mapa de 167 polígonos en una pantalla de 375px no se
 * puede usar; que además se baje sobre la red de datos de alguien parado en la
 * calle es el peor de los dos mundos.
 *
 * El hook arranca en `false` a propósito: en el servidor no hay ancho, y
 * equivocarse hacia "teléfono" solo demora un componente, mientras que
 * equivocarse hacia "escritorio" le manda cientos de kB a un celular.
 */
export function usarEscritorio(): boolean {
  const [esEscritorio, setEsEscritorio] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_ESCRITORIO);
    const actualizar = () => setEsEscritorio(consulta.matches);

    actualizar();
    // Girar el teléfono o achicar la ventana tiene que montar y desmontar de
    // verdad, no dejar el mapa a medio camino.
    consulta.addEventListener("change", actualizar);
    return () => consulta.removeEventListener("change", actualizar);
  }, []);

  return esEscritorio;
}
