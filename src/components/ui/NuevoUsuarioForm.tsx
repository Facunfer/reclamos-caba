// src/components/ui/NuevoUsuarioForm.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  comunaId: number;
}

export default function NuevoUsuarioForm({ comunaId }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", confirmar: "", nombre: "", telefono: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/usuarios/crear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        nombre: form.nombre,
        telefono: form.telefono,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error al crear el usuario.");
      return;
    }

    setSuccess(`Usuario ${form.email} creado correctamente.`);
    setTimeout(() => { router.push("/panel/usuarios"); router.refresh(); }, 1500);
  }

  return (
    <form onSubmit={handleSubmit} className="lla-card p-8 space-y-6 max-w-lg shadow-2xl">
      <div className="space-y-2">
        <label className="block text-xs font-bold text-muted uppercase tracking-widest ml-1">Nombre *</label>
        <input
          required
          type="text"
          value={form.nombre}
          onChange={e => set("nombre", e.target.value)}
          placeholder="Ej: María García"
          className="lla-input w-full px-4 py-3 text-sm focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold text-muted uppercase tracking-widest ml-1">Teléfono *</label>
        <input
          required
          type="tel"
          value={form.telefono}
          onChange={e => set("telefono", e.target.value)}
          placeholder="11-1234-5678"
          className="lla-input w-full px-4 py-3 text-sm focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold text-muted uppercase tracking-widest ml-1">Email *</label>
        <input
          required
          type="email"
          value={form.email}
          onChange={e => set("email", e.target.value)}
          placeholder="usuario@ejemplo.com"
          className="lla-input w-full px-4 py-3 text-sm focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold text-muted uppercase tracking-widest ml-1">Contraseña *</label>
        <input
          required
          type="password"
          value={form.password}
          onChange={e => set("password", e.target.value)}
          placeholder="Mínimo 6 caracteres"
          className="lla-input w-full px-4 py-3 text-sm focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold text-muted uppercase tracking-widest ml-1">Confirmar contraseña *</label>
        <input
          required
          type="password"
          value={form.confirmar}
          onChange={e => set("confirmar", e.target.value)}
          placeholder="Repetir contraseña"
          className="lla-input w-full px-4 py-3 text-sm focus:outline-none"
        />
      </div>

      <div className="bg-black/40 border border-card-border rounded-lg px-4 py-3 text-xs text-muted">
        El nuevo usuario quedará asignado a{" "}
        <span className="text-primary font-bold">Comuna {String(comunaId).padStart(2, "0")}</span>{" "}
        y <span className="text-white font-bold">no</span> podrá crear otros usuarios.
      </div>

      {error && (
        <div className="bg-red-950/20 border border-red-900/50 p-4 rounded-lg">
          <p className="text-red-400 text-xs font-bold uppercase tracking-tight">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-950/20 border border-green-900/50 p-4 rounded-lg">
          <p className="text-green-400 text-xs font-bold uppercase tracking-tight">{success}</p>
        </div>
      )}

      <div className="flex gap-4 pt-2">
        <button
          type="submit"
          disabled={loading}
          className={`flex-1 py-4 uppercase tracking-[0.2em] text-xs font-black shadow-lg transition-all ${
            loading ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : "lla-btn-primary shadow-primary/20"
          }`}
        >
          {loading ? "Creando..." : "Crear Usuario"}
        </button>
        <a href="/panel/usuarios" className="lla-card px-8 py-4 text-muted hover:text-white hover:border-muted transition-all text-center uppercase tracking-widest text-[10px] font-bold">
          Volver
        </a>
      </div>
    </form>
  );
}
