import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NuevaSugerenciaForm from "@/components/ui/NuevaSugerenciaForm";

export default async function NuevaSugerenciaPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect("/login");
    }

    // Get user's comuna_id
    const { data: perfil } = await supabase
        .from("perfiles")
        .select("comuna_id")
        .eq("user_id", user.id)
        .single();

    const comunaId = perfil?.comuna_id || 1;

    // Get active suggestion types
    const { data: tipos } = await supabase
        .from("tipos_sugerencia")
        .select("*")
        .eq("activo", true)
        .order("nombre");

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
            <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter text-white drop-shadow-md">
                    Ingresar Sugerencia
                </h1>
                <p className="text-primary text-sm font-bold tracking-widest uppercase mt-2">
                    Comuna {String(comunaId).padStart(2, '0')}
                </p>
            </div>

            <NuevaSugerenciaForm comunaId={comunaId} userId={user.id} tipos={tipos || []} />
        </div>
    );
}
