"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/rutas";

export default function PublicLoginPage() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(api("/api/public/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo iniciar sesión.");
        return;
      }
      router.push("/public");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative z-50">
      <div className="w-full max-w-sm lla-card p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-xl font-black text-white uppercase tracking-widest">Reclamos CABA</h1>
          <p className="text-[10px] text-primary uppercase font-bold tracking-[0.2em] mt-2">Acceso a Mapa Público</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-muted uppercase tracking-widest ml-1">Usuario</label>
            <input
              type="text"
              required
              autoComplete="username"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="lla-input w-full px-4 py-3 text-sm focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold text-muted uppercase tracking-widest ml-1">Contraseña</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="lla-input w-full px-4 py-3 text-sm focus:outline-none"
            />
          </div>
          {error && <div className="text-red-500 text-xs font-bold uppercase tracking-tight">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="lla-btn-primary w-full py-4 uppercase tracking-[0.2em] text-xs font-black shadow-lg disabled:opacity-50"
          >
            {loading ? "Verificando..." : "Ingresar"}
          </button>
        </form>
        <div className="mt-8 text-center border-t border-white/10 pt-6">
          <Link href="/login" className="text-[10px] text-muted hover:text-white uppercase font-bold tracking-widest transition-colors">
            Ir al Panel Comunal →
          </Link>
        </div>
      </div>
    </div>
  );
}
