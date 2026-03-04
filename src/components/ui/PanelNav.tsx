// src/components/ui/PanelNav.tsx
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Props {
  user: User;
  comunaId: number | null;
}

export default function PanelNav({ user, comunaId }: Props) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-black border-b border-card-border text-white shadow-xl">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/panel" className="font-extrabold text-xl tracking-tight hover:text-primary transition-colors">
            RECLAMOS <span className="text-primary">CABA</span>
          </Link>
          {comunaId && (
            <span className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Comuna {String(comunaId).padStart(2, "0")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest">
          <nav className="flex items-center gap-4 border-r border-white/10 pr-6 mr-2">
            <Link href="/panel" className="hover:text-white transition-colors">Ver Reclamos</Link>
            <Link href="/panel/sugerencias" className="text-indigo-200 hover:text-white transition-colors">Ver Sugerencias</Link>
          </nav>

          <Link href="/panel/nuevo" className="lla-btn-primary px-4 py-2 text-[10px]">
            + Nuevo reclamo
          </Link>
          <Link href="/panel/sugerencias/nuevo" className="text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-colors px-4 py-2 rounded-lg text-[10px]">
            + Nueva Sugerencia
          </Link>
          <Link href="/public" className="text-muted hover:text-white transition-colors ml-4">Vista pública</Link>
          <button onClick={handleLogout} className="text-muted hover:text-red-400 transition-colors">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
