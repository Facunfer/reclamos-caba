// src/app/public/comunas/page.tsx
import { createClient as createAdminClient } from "@supabase/supabase-js";
import Link from "next/link";
import LogoutButton from "@/components/ui/LogoutButton";

export const revalidate = 60;

export default async function PublicUsuariosPage() {
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: perfiles } = await adminClient
    .from("perfiles")
    .select("comuna_id, user_id, can_create_users")
    .order("comuna_id", { ascending: true });

  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const emailPorId = Object.fromEntries(authUsers.map(u => [u.id, u.email ?? "-"]));

  // Agrupar por comuna: responsable principal (can_create_users) y usuarios adicionales
  const comunasMap = new Map<number, { responsable: string; adicionales: string[] }>();
  for (const p of perfiles ?? []) {
    const email = emailPorId[p.user_id] ?? "-";
    if (!comunasMap.has(p.comuna_id)) {
      comunasMap.set(p.comuna_id, { responsable: "", adicionales: [] });
    }
    const entry = comunasMap.get(p.comuna_id)!;
    if (p.can_create_users) {
      entry.responsable = email;
    } else {
      entry.adicionales.push(email);
    }
  }

  const comunas = Array.from(comunasMap.entries()).map(([id, data]) => ({ id, ...data }));

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-indigo-700 text-white py-3 px-4 flex items-center justify-between shadow">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="font-bold text-lg">Reclamos CABA – Usuarios</h1>
            <p className="text-indigo-200 text-xs">Ciudad Autónoma de Buenos Aires</p>
          </div>
          <nav className="hidden md:flex gap-4 fade-in">
            <Link href="/public" className="text-indigo-200 hover:text-white transition-colors text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-white/10">Reclamos</Link>
            <Link href="/public/sugerencias" className="text-indigo-200 hover:text-white transition-colors text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-white/10">Sugerencias</Link>
            <Link href="/public/circuitos" className="text-indigo-200 hover:text-white transition-colors text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-white/10">Circuitos</Link>
            <Link href="/public/comunas" className="text-white bg-white/20 transition-colors text-sm font-semibold px-3 py-1.5 rounded-lg border border-white/30 shadow-sm">Usuarios</Link>
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
        <Link href="/public" className="flex-1 py-2 text-center text-indigo-200 hover:bg-white/10">Reclamos</Link>
        <Link href="/public/sugerencias" className="flex-1 py-2 text-center text-indigo-200 hover:bg-white/10">Sugerencias</Link>
        <Link href="/public/circuitos" className="flex-1 py-2 text-center text-indigo-200 hover:bg-white/10">Circuitos</Link>
        <Link href="/public/comunas" className="flex-1 py-2 text-center bg-white/20 font-bold border-b-2 border-white">Usuarios</Link>
      </nav>

      <main className="flex-1 bg-black px-6 py-8">
        <h2 className="text-xs font-black text-primary uppercase tracking-[0.3em] mb-8 text-center">
          Equipos por <span className="text-white">Comuna</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {comunas.map(({ id, responsable, adicionales }) => (
            <div key={id} className="lla-card p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-black text-white">
                  Comuna {String(id).padStart(2, "0")}
                </span>
                <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                  {1 + adicionales.length} usuario{1 + adicionales.length !== 1 ? "s" : ""}
                </span>
              </div>

              {responsable && (
                <div>
                  <p className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1">Responsable</p>
                  <a href={`mailto:${responsable}`} className="text-xs text-white hover:text-primary transition-colors truncate block">
                    {responsable}
                  </a>
                </div>
              )}

              {adicionales.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1">Usuarios adicionales</p>
                  <div className="flex flex-col gap-1">
                    {adicionales.map((email) => (
                      <a key={email} href={`mailto:${email}`} className="text-xs text-muted hover:text-white transition-colors truncate">
                        {email}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
