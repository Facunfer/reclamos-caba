// src/app/panel/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PanelFilters from "@/components/ui/PanelFilters";
import ReclamosTable from "@/components/ui/ReclamosTable";
import type { Reclamo } from "@/types";

const PAGE_SIZE = 20;

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; urgencia?: string; tipo?: string; desde?: string; hasta?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1") - 1;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: perfil }, { data: tipos }] = await Promise.all([
    supabase.from("perfiles").select("comuna_id").eq("user_id", user.id).single(),
    supabase.from("tipos_reclamo").select("id, nombre").eq("activo", true).order("nombre")
  ]);

  if (!perfil) {
    return <div className="text-red-600 p-4">Error: No se encontró perfil para este usuario.</div>;
  }

  let query = supabase
    .from("reclamos")
    .select("*", { count: "exact" })
    .eq("comuna_id", perfil.comuna_id)
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (params.urgencia) query = query.eq("urgencia", params.urgencia);
  if (params.tipo) query = query.eq("tipo_reclamo", params.tipo);
  if (params.desde) query = query.gte("created_at", params.desde);
  if (params.hasta) query = query.lte("created_at", params.hasta + "T23:59:59");

  const { data: reclamosRaw, count, error } = await query;

  if (error) {
    return <div className="text-red-600 p-4">Error cargando reclamos: {error.message}</div>;
  }

  // Fetch files separately to avoid relationship cache issues
  const reclamosIds = (reclamosRaw as any[])?.map(r => r.id) || [];
  const { data: archivos } = reclamosIds.length > 0
    ? await supabase.from("reclamo_archivos").select("*").in("reclamo_id", reclamosIds)
    : { data: [] };

  const reclamos = (reclamosRaw as any[])?.map(r => ({
    ...r,
    reclamo_archivos: archivos?.filter(a => a.reclamo_id === r.id) || []
  }));

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">
          Reclamos – Comuna {String(perfil.comuna_id).padStart(2, "0")}
        </h1>
        <span className="text-sm text-muted">{count ?? 0} en total</span>
      </div>

      <PanelFilters current={params} tipos={tipos || []} />

      <ReclamosTable reclamos={(reclamos as Reclamo[]) ?? []} />

      {totalPages > 1 && (
        <Pagination current={page + 1} total={totalPages} params={params} />
      )}
    </div>
  );
}

function Pagination({
  current,
  total,
  params,
}: {
  current: number;
  total: number;
  params: Record<string, string | undefined>;
}) {
  function pageUrl(p: number) {
    const q = new URLSearchParams(params as Record<string, string>);
    q.set("page", String(p));
    return `/panel?${q.toString()}`;
  }
  return (
    <div className="flex gap-1 justify-center mt-6">
      {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
        <a
          key={p}
          href={pageUrl(p)}
          className={`w-8 h-8 flex items-center justify-center rounded text-sm ${p === current
            ? "bg-primary text-white"
            : "bg-black/40 border border-white/5 text-muted hover:border-primary/50"
            }`}
        >
          {p}
        </a>
      ))}
    </div>
  );
}
