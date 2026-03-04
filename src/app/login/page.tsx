// src/app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
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
          <a href="/public" className="hover:text-primary transition-colors">← Volver al mapa público</a>
        </p>
      </div>
    </div>
  );
}
