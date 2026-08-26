// src/app/public/page.tsx
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import PublicPageClient from "@/components/PublicPageClient";
import { getReclamosUnificados } from "@/lib/reclamosUnificados";
import type { TipoReclamo, ContactoComuna } from "@/types";
import PublicHeader from "@/components/ui/PublicHeader";

export const revalidate = 60;

export default async function PublicPage() {
  const supabase = await createClient();

  const [{ data: tipos }, dataUnificada] = await Promise.all([
    supabase.from("tipos_reclamo").select("id, nombre").eq("activo", true).order("nombre"),
    getReclamosUnificados(),
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
      <PublicHeader active="reclamos" titulo="Reclamos CABA – Mapa Público" />
      <main className="flex-1 flex flex-col">
        <PublicPageClient
          data={dataUnificada}
          tipos={(tipos as TipoReclamo[]) ?? []}
          contactosComunas={contactosComunas}
        />
      </main>
    </div>
  );
}
