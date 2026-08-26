// src/app/public/comunas/page.tsx
import { createClient as createAdminClient } from "@supabase/supabase-js";
import PublicHeader from "@/components/ui/PublicHeader";

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
      <PublicHeader active="usuarios" titulo="Reclamos CABA – Usuarios" />

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
