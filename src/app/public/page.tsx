// src/app/public/page.tsx
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import PublicPageClient from "@/components/PublicPageClient";
import type { ReclamoPublico, TipoReclamo, ContactoComuna } from "@/types";
import Link from "next/link";
import LogoutButton from "@/components/ui/LogoutButton";

export const revalidate = 60;

export default async function PublicPage() {
  const supabase = await createClient();

  const [{ data: tipos }, { data: reclamos }] = await Promise.all([
    supabase.from("tipos_reclamo").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("reclamos_publicos").select("*").order("created_at", { ascending: false }),
  ]);

  // Contactos de comunas: se obtienen con admin client (auth.users no es accesible públicamente)
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: perfiles } = await adminClient
    .from("perfiles")
    .select("comuna_id, user_id")
    .eq("can_create_users", true)
    .order("comuna_id", { ascending: true });

  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const emailPorId = Object.fromEntries(authUsers.map(u => [u.id, u.email ?? ""]));

  const contactosComunas: ContactoComuna[] = (perfiles ?? []).map(p => ({
    comuna_id: p.comuna_id,
    email: emailPorId[p.user_id] ?? "",
  })).filter(c => c.email);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-indigo-700 text-white py-3 px-4 flex items-center justify-between shadow">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="font-bold text-lg">Reclamos CABA – Mapa Público</h1>
            <p className="text-indigo-200 text-xs">Ciudad Autónoma de Buenos Aires</p>
          </div>
          <nav className="hidden md:flex gap-4 fade-in">
            <Link href="/public" className="text-white bg-white/20 transition-colors text-sm font-semibold px-3 py-1.5 rounded-lg border border-white/30 shadow-sm">Reclamos</Link>
            <Link href="/public/sugerencias" className="text-indigo-200 hover:text-white transition-colors text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-white/10">Sugerencias</Link>
            <Link href="/public/circuitos" className="text-indigo-200 hover:text-white transition-colors text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-white/10">Circuitos</Link>
            <Link href="/public/comunas" className="text-indigo-200 hover:text-white transition-colors text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-white/10">Usuarios</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <LogoutButton />
          <Link href="/login" className="text-sm bg-white text-indigo-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-50">
            Panel comunal
          </Link>
        </div>
      </header>
      {/* Mobile nav */}
      <nav className="md:hidden flex bg-indigo-800 text-white text-sm">
        <Link href="/public" className="flex-1 py-2 text-center bg-white/20 font-bold border-b-2 border-white">Reclamos</Link>
        <Link href="/public/sugerencias" className="flex-1 py-2 text-center text-indigo-200 hover:bg-white/10">Sugerencias</Link>
        <Link href="/public/circuitos" className="flex-1 py-2 text-center text-indigo-200 hover:bg-white/10">Circuitos</Link>
        <Link href="/public/comunas" className="flex-1 py-2 text-center text-indigo-200 hover:bg-white/10">Usuarios</Link>
      </nav>
      <main className="flex-1 flex flex-col">
        <PublicPageClient
          initialReclamos={(reclamos as ReclamoPublico[]) ?? []}
          tipos={(tipos as TipoReclamo[]) ?? []}
          contactosComunas={contactosComunas}
        />
      </main>
    </div>
  );
}
