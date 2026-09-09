// src/app/login/page.tsx
"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Motivos por los que alguien puede aterrizar acá viniendo del botón del Portal
 * en vez de haber escrito la URL.
 *
 * Son dos y no siete a propósito: del otro lado el canje distingue firma
 * inválida, versión distinta, payload roto, token reusado… y todo eso se
 * colapsa acá en "inválido". Contarle a quien está probando tokens en cuál de
 * los siete chequeos falló es ayudarlo. El motivo real queda en el log del
 * servidor.
 */
const MENSAJE_SSO: Record<string, string> = {
  expirado:
    "El acceso desde el Portal tardó demasiado y venció. Volvé al Portal y tocá el botón de nuevo, o entrá acá con tu usuario de comuna.",
  invalido:
    "No se pudo abrir la sesión desde el Portal. Entrá con tu usuario de comuna o avisale al administrador.",
};

/**
 * `useSearchParams` obliga a un límite de Suspense: sin él, Next no puede
 * prerenderizar esta página —que hoy es estática— y el build falla con
 * "useSearchParams() should be wrapped in a suspense boundary".
 *
 * El `fallback` es `null` y no un esqueleto porque lo que está adentro es el
 * formulario entero, que se hidrata de inmediato: un esqueleto se vería un
 * frame y sería un parpadeo, no información.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const avisoSSO = MENSAJE_SSO[params.get("sso") ?? ""] ?? null;
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Si no escribieron @, completar el dominio automáticamente
    const email = usuario.includes("@")
      ? usuario.trim()
      : `${usuario.trim()}@reclamos.gob.ar`;

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Usuario o contraseña incorrectos.");
      setLoading(false);
    } else {
      router.push("/panel");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="lla-card w-full max-w-md p-8">
        <h1 className="text-3xl font-extrabold text-center text-white mb-2 tracking-tight">
          RECLAMOS <span className="text-primary">CABA</span>
        </h1>
        <p className="text-center text-muted text-sm mb-8 uppercase tracking-widest font-semibold">Panel de Gestión por Comuna</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-muted uppercase mb-1 ml-1">Usuario</label>
            <input
              type="text"
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="c1"
              className="lla-input w-full px-4 py-3 text-sm focus:outline-none"
            />
            <p className="text-[10px] text-muted mt-2 ml-1 italic">Ingresá tu usuario: c1, c2, ... c15</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted uppercase mb-1 ml-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="lla-input w-full px-4 py-3 text-sm focus:outline-none"
            />
            <p className="text-[10px] text-muted mt-2 ml-1 italic">Contraseña: 123456</p>
          </div>

          {/*
            Aviso del puente. Va en ámbar y no en rojo: no es un error de quien
            está mirando la pantalla —no se equivocó de contraseña, ni siquiera
            tipeó nada— y el camino de salida (entrar con el usuario de comuna)
            está justo arriba.
          */}
          {avisoSSO && !error && (
            <p className="text-amber-300 text-xs bg-amber-950/30 border border-amber-900/50 rounded-lg px-4 py-3 leading-relaxed">
              {avisoSSO}
            </p>
          )}

          {error && (
            <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="lla-btn-primary w-full py-3 uppercase tracking-wider text-sm"
          >
            {loading ? "Ingresando..." : "Entrar al Sistema"}
          </button>
        </form>

        <p className="text-center mt-8 text-xs text-muted">
          <Link href="/public" className="hover:text-primary transition-colors">← Volver al mapa público</Link>
        </p>
      </div>
    </div>
  );
}
