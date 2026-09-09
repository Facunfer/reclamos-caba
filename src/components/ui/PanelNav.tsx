// src/components/ui/PanelNav.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PORTAL_URL } from "@/lib/rutas";
import type { User } from "@supabase/supabase-js";

interface Props {
  user: User;
  comunaId: number | null;
  canCreateUsers?: boolean;
  isMaster?: boolean;
}

/**
 * Barra del panel comunal.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Dos formas según el ancho, un solo listado de links
 * ─────────────────────────────────────────────────────────────────────────
 * De `md` para arriba queda exactamente como estaba: todo en una fila. Abajo de
 * eso no entra — son seis destinos más el botón de salir, y en 375px la fila se
 * desbordaba o se apretaba en targets de ~20px, que es la mitad del mínimo
 * cómodo.
 *
 * Los links se declaran UNA vez (`DESTINOS`) y las dos formas los recorren. La
 * lista depende de permisos (`canCreateUsers`/`isMaster`): con dos copias, el
 * día que se agregue un módulo con permiso propio se arregla una y la otra
 * queda mostrando de más.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * "Volver al Portal"
 * ─────────────────────────────────────────────────────────────────────────
 * Reclamos ahora se sirve adentro del Portal Territorial, bajo `/reclamos` del
 * mismo origen. Para el referente, tocar el botón del Portal y aterrizar acá es
 * cambiar de sección, no de sistema — pero el aspecto es completamente distinto
 * (negro y violeta contra el violeta del Portal), así que sin una salida
 * explícita la sensación es la de haberse ido a otro lado sin forma de volver.
 * El navegador tiene "atrás", pero en modo standalone en iOS no hay barra: el
 * gesto existe y no todo el mundo lo conoce.
 */

interface Destino {
  href: string;
  label: string;
  clase: string;
  visible: boolean;
}

export default function PanelNav({ user, comunaId, canCreateUsers = false, isMaster = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  // Cerrar al navegar. Sin esto, tocás un destino y el menú queda abierto
  // tapando la página que acabás de pedir.
  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const destinos: Destino[] = [
    { href: "/panel", label: "Ver Reclamos", clase: "hover:text-white", visible: true },
    { href: "/panel/sugerencias", label: "Ver Sugerencias", clase: "text-indigo-200 hover:text-white", visible: true },
    { href: "/panel/circuitos", label: "Circuitos", clase: "text-indigo-200 hover:text-white", visible: true },
    {
      href: "/panel/usuarios",
      label: isMaster ? "Todos los Usuarios" : "Usuarios",
      clase: "text-yellow-400 hover:text-yellow-200",
      visible: canCreateUsers || isMaster,
    },
  ].filter((d) => d.visible);

  return (
    <header className="bg-black border-b border-card-border text-white shadow-xl">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <Link
            href="/panel"
            // El logo es también el "volver al listado" desde cualquier
            // subpágina, así que necesita los 44px como cualquier otro destino.
            className="flex min-h-11 items-center font-extrabold text-lg md:min-h-0 md:text-xl tracking-tight hover:text-primary transition-colors whitespace-nowrap"
          >
            RECLAMOS <span className="text-primary">CABA</span>
          </Link>
          {comunaId && (
            <span className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
              Comuna {String(comunaId).padStart(2, "0")}
            </span>
          )}
        </div>

        {/* ═══════════ Escritorio ═══════════ */}
        <div className="hidden md:flex items-center gap-6 text-xs font-bold uppercase tracking-widest">
          <a
            href={PORTAL_URL}
            className="text-muted hover:text-white transition-colors whitespace-nowrap"
            title="Volver al Portal Territorial"
          >
            ← Portal
          </a>
          <nav className="flex items-center gap-4 border-r border-l border-white/10 px-6">
            {destinos.map((d) => (
              <Link key={d.href} href={d.href} className={`${d.clase} transition-colors`}>
                {d.label}
              </Link>
            ))}
          </nav>

          <Link href="/panel/nuevo" className="lla-btn-primary px-4 py-2 text-[10px]">
            + Nuevo reclamo
          </Link>
          <Link href="/panel/sugerencias/nuevo" className="text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-colors px-4 py-2 rounded-lg text-[10px]">
            + Nueva Sugerencia
          </Link>
          <button onClick={handleLogout} className="text-muted hover:text-red-400 transition-colors">
            Salir
          </button>
        </div>

        {/* ═══════════ Teléfono ═══════════ */}
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          // 44px de lado. Es el control que abre todo lo demás: si se falla,
          // la app entera parece no responder.
          className="md:hidden -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl text-white transition-colors hover:bg-white/5"
          aria-expanded={abierto}
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
        >
          {abierto ? "✕" : "☰"}
        </button>
      </div>

      {/*
        El menú se monta y desmonta en vez de esconderse con CSS. Es la
        excepción a la regla de "esconder con clases": acá el estado abierto/
        cerrado es JavaScript de todos modos (hay un `useState`), así que no hay
        HTML del servidor que preservar, y montarlo evita que los links queden
        en el orden de tabulación mientras el menú está cerrado.
      */}
      {abierto ? (
        <nav className="md:hidden border-t border-card-border bg-black px-4 pb-4">
          <ul className="flex flex-col">
            {destinos.map((d) => (
              <li key={d.href}>
                <Link
                  href={d.href}
                  // `min-h-11` y no `h-11`: si algún label se parte en dos
                  // líneas, el renglón crece en vez de recortar el texto.
                  className={`flex min-h-11 items-center border-b border-white/5 text-xs font-bold uppercase tracking-widest ${d.clase} transition-colors`}
                >
                  {d.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/panel/nuevo"
              className="lla-btn-primary flex min-h-11 items-center justify-center text-[11px] uppercase tracking-widest"
            >
              + Nuevo reclamo
            </Link>
            <Link
              href="/panel/sugerencias/nuevo"
              className="flex min-h-11 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-white/20"
            >
              + Nueva Sugerencia
            </Link>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-3">
            <a
              href={PORTAL_URL}
              className="flex min-h-11 items-center text-[11px] font-bold uppercase tracking-widest text-muted transition-colors hover:text-white"
            >
              ← Volver al Portal
            </a>
            <button
              onClick={handleLogout}
              className="flex min-h-11 items-center text-[11px] font-bold uppercase tracking-widest text-muted transition-colors hover:text-red-400"
            >
              Salir
            </button>
          </div>

          {/*
            El email va abajo y chico a propósito: no es una acción, es la
            respuesta a "¿con qué cuenta estoy?", que en un sistema donde las 15
            comunas comparten contraseña es una pregunta que la gente se hace.
          */}
          <p className="mt-3 truncate text-[10px] text-muted/60">{user.email}</p>
        </nav>
      ) : null}
    </header>
  );
}
