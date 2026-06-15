"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PublicAuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const auth = sessionStorage.getItem("public_auth");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
    setIsChecking(false);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const masterUser = process.env.NEXT_PUBLIC_MASTER_USER || "MASTER";
    const masterPass = process.env.NEXT_PUBLIC_MASTER_PASS || "123456";

    if (user === masterUser && password === masterPass) {
      sessionStorage.setItem("public_auth", "true");
      setIsAuthenticated(true);
      setError("");
    } else {
      setError("Credenciales incorrectas.");
    }
  };

  if (isChecking) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white font-bold tracking-widest text-xs uppercase animate-pulse">Cargando...</div>;
  }

  if (!isAuthenticated) {
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="lla-input w-full px-4 py-3 text-sm focus:outline-none"
              />
            </div>
            {error && <div className="text-red-500 text-xs font-bold uppercase tracking-tight">{error}</div>}
            <button
              type="submit"
              className="lla-btn-primary w-full py-4 uppercase tracking-[0.2em] text-xs font-black shadow-lg"
            >
              Ingresar
            </button>
          </form>
          <div className="mt-8 text-center border-t border-white/10 pt-6">
            <a href="/login" className="text-[10px] text-muted hover:text-white uppercase font-bold tracking-widest transition-colors">
              Ir al Panel Comunal →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
