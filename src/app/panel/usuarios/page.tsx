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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios del Sistema</h1>
          <p className="text-muted text-xs mt-1">{perfiles?.length ?? 0} usuarios registrados</p>
        </div>
        {miPerfil.can_create_users && (
          <Link
            href="/panel/usuarios/nuevo"
            // 44px en teléfono. Es la única acción de esta pantalla.
            className="lla-btn-primary flex min-h-11 shrink-0 items-center px-5 text-[10px] font-black uppercase tracking-widest md:min-h-0 md:py-2.5"
          >
            + Nuevo Usuario
          </Link>
        )}
      </div>

      {/*
        Escritorio: la tabla de siempre. Teléfono: tarjetas.
        Cinco columnas de las cuales una es un email completo no entran en
        375px; con `overflow-x-auto` la tabla scrollea de costado y se pierde la
        columna de referencia, que es la peor forma de leer una lista.
        Mismo criterio que en el listado de reclamos.
      */}
      <div className="hidden md:block lla-card overflow-x-auto">
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

      {/* ═══════════ Teléfono ═══════════ */}
      <ul className="md:hidden flex flex-col gap-3">
        {perfiles?.map((p) => (
          <li key={p.user_id} className="lla-card p-4">
            <div className="flex items-start justify-between gap-3">
              {/* `break-all`: un email largo sin espacios no envuelve solo y
                  desborda la tarjeta. */}
              <span className="text-sm font-medium text-white break-all">
                {emailPorId[p.user_id] ?? p.user_id}
              </span>
              <span className="shrink-0 bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {String(p.comuna_id).padStart(2, "0")}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
              {p.user_id === user.id && (
                <span className="bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-bold uppercase">
                  Vos
                </span>
              )}
              {/*
                Los permisos se muestran solo cuando los TIENE. En la tabla hay
                una columna "No" por cada uno porque una columna vacía se ve
                rota; en una tarjeta, un renglón que dice "Puede crear usuarios:
                No" ocupa lugar para no informar nada.
              */}
              {p.can_create_users && (
                <span className="bg-green-950/40 text-green-400 border border-green-900/40 px-2 py-0.5 rounded-full font-bold">
                  Puede crear usuarios
                </span>
              )}
              {p.is_master && (
                <span className="bg-yellow-950/40 text-yellow-400 border border-yellow-900/40 px-2 py-0.5 rounded-full font-bold">
                  Master
                </span>
              )}
              <span className="text-muted">
                {new Date(p.created_at).toLocaleDateString("es-AR")}
              </span>
            </div>
          </li>
        ))}
        {(!perfiles || perfiles.length === 0) && (
          <li className="lla-card text-center text-muted py-16 text-xs">
            No hay usuarios registrados.
          </li>
        )}
      </ul>
    </div>
  );
}
