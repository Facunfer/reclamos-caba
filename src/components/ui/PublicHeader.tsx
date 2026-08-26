// Header + nav compartido de /public. Antes estaba duplicado (con leves
// diferencias de título) en las 4 páginas del dashboard público; se unifica
// acá porque ahora además tiene que ocultar pestañas según el rol logueado
// — mantenerlo duplicado hubiera significado repetir esa lógica 4 veces.
import Link from "next/link";
import LogoutButton from "@/components/ui/LogoutButton";
import { getPublicRole } from "@/lib/publicSession";
import { puedeVer, type PublicTab } from "@/lib/publicAccounts";

interface Props {
  active: PublicTab;
  titulo: string;
}

const TABS: { tab: PublicTab; href: string; label: string }[] = [
  { tab: "reclamos", href: "/public", label: "Reclamos" },
  { tab: "sugerencias", href: "/public/sugerencias", label: "Sugerencias" },
  { tab: "circuitos", href: "/public/circuitos", label: "Circuitos" },
  { tab: "usuarios", href: "/public/comunas", label: "Usuarios" },
];

export default async function PublicHeader({ active, titulo }: Props) {
  const role = await getPublicRole();
  const visibles = TABS.filter((t) => puedeVer(role, t.tab));

  return (
    <>
      <header className="bg-indigo-700 text-white py-3 px-4 flex items-center justify-between shadow">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="font-bold text-lg">{titulo}</h1>
            <p className="text-indigo-200 text-xs">Ciudad Autónoma de Buenos Aires</p>
          </div>
          <nav className="hidden md:flex gap-4 fade-in">
            {visibles.map(({ tab, href, label }) => (
              <Link
                key={tab}
                href={href}
                className={
                  tab === active
                    ? "text-white bg-white/20 transition-colors text-sm font-semibold px-3 py-1.5 rounded-lg border border-white/30 shadow-sm"
                    : "text-indigo-200 hover:text-white transition-colors text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-white/10"
                }
              >
                {label}
              </Link>
            ))}
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
        {visibles.map(({ tab, href, label }) => (
          <Link
            key={tab}
            href={href}
            className={
              tab === active
                ? "flex-1 py-2 text-center bg-white/20 font-bold border-b-2 border-white"
                : "flex-1 py-2 text-center text-indigo-200 hover:bg-white/10"
            }
          >
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
