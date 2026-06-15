// src/app/panel/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PanelNav from "@/components/ui/PanelNav";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("comuna_id, can_create_users, is_master")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="min-h-screen flex flex-col">
      <PanelNav
        user={user}
        comunaId={perfil?.comuna_id ?? null}
        canCreateUsers={perfil?.can_create_users ?? false}
        isMaster={perfil?.is_master ?? false}
      />
      <main className="flex-1 container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
