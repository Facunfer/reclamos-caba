// src/app/panel/usuarios/page.tsx
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: miPerfil } = await supabase
    .from("perfiles")
    .select("comuna_id, can_create_users, is_master")
    .eq("user_id", user.id)
    .single();

  if (!miPerfil?.can_create_users && !miPerfil?.is_master) {
    redirect("/panel");
  }

  // Cliente admin puro para bypassear RLS
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Master ve todos; usuario comunal solo ve los que él creó (+ su propio perfil)
  let perfilesQuery = adminClient
    .from("perfiles")
    .select("user_id, comuna_id, can_create_users, is_master, created_at, created_by")
    .order("created_at", { ascending: true });

  if (!miPerfil.is_master) {
    // Muestra: yo mismo + usuarios que yo creé + sub-usuarios de mi comuna sin created_by (legado)
    perfilesQuery = perfilesQuery.or(
      `user_id.eq.${user.id},created_by.eq.${user.id},and(comuna_id.eq.${miPerfil.comuna_id},can_create_users.eq.false,created_by.is.null)`
    );
  }

  const { data: perfiles, error: perfilesError } = await perfilesQuery;

  const { data: authData, error: authError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const emailPorId = Object.fromEntries((authData?.users ?? []).map(u => [u.id, u.email ?? "-"]));

  return (
    <div>
      {(perfilesError || authError) && (
        <div className="mb-4 bg-red-950/20 border border-red-900/50 p-4 rounded-lg text-red-400 text-xs font-bold">
          {perfilesError && <div>Error perfiles: {perfilesError.message}</div>}
          {authError && <div>Error auth: {authError.message}</div>}
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios del Sistema</h1>
          <p className="text-muted text-xs mt-1">{perfiles?.length ?? 0} usuarios registrados</p>
        </div>
        {miPerfil.can_create_users && (
          <Link href="/panel/usuarios/nuevo" className="lla-btn-primary px-5 py-2.5 text-[10px] font-black uppercase tracking-widest">
            + Nuevo Usuario
          </Link>
        )}
      </div>

      <div className="lla-card overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-black/40 text-left text-[10px] text-muted uppercase tracking-[0.2em] font-bold border-b border-card-border">
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Comuna</th>
              <th className="px-6 py-4">Puede crear usuarios</th>
              <th className="px-6 py-4">Master</th>
              <th className="px-6 py-4">Creado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {perfiles?.map((p) => (
              <tr key={p.user_id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4 font-medium text-white">
                  {emailPorId[p.user_id] ?? p.user_id}
                  {p.user_id === user.id && (
                    <span className="ml-2 text-[9px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 rounded-full font-bold uppercase">
                      Vos
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-muted">
                  <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {String(p.comuna_id).padStart(2, "0")}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    p.can_create_users
                      ? "bg-green-950/40 text-green-400 border-green-900/40"
                      : "bg-black/40 text-muted border-card-border"
                  }`}>
                    {p.can_create_users ? "Sí" : "No"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    p.is_master
                      ? "bg-yellow-950/40 text-yellow-400 border-yellow-900/40"
                      : "bg-black/40 text-muted border-card-border"
                  }`}>
                    {p.is_master ? "Sí" : "No"}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted">
                  {new Date(p.created_at).toLocaleDateString("es-AR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!perfiles || perfiles.length === 0) && (
          <div className="text-center text-muted py-16 text-xs">No hay usuarios registrados.</div>
        )}
      </div>
    </div>
  );
}
