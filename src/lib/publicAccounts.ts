// Cuentas del gate de /public. Server-only.
//
// MASTER_USER/MASTER_PASS siguen siendo la cuenta "master" (ve todas las
// pestañas), para no romper el .env.local ya desplegado.
//
// Cuentas adicionales con permisos restringidos van en PUBLIC_ACCOUNTS, una
// sola variable de entorno con el formato:
//   usuario:contraseña:rol,usuario2:contraseña2:rol2,...
// Ejemplo: PUBLIC_ACCOUNTS=comunicacion:ciudadvioleta:reclamos
//
// Se eligió una lista en un env var (no una tabla en la base) porque el
// dashboard público nunca tuvo usuarios individuales — es coherente con que
// ya era así para "master", y agregar una cuenta más es una línea de config,
// sin migraciones ni deploys de esquema.

export interface PublicAccount {
  user: string;
  pass: string;
  role: string;
}

// Pestañas visibles por rol. "master" es el único con acceso total; un rol
// no listado acá (incluido cualquier valor nuevo en PUBLIC_ACCOUNTS que
// todavía no se haya sumado a este mapa) cae en el set más restringido.
export const PUBLIC_TABS = ["reclamos", "sugerencias", "circuitos", "usuarios"] as const;
export type PublicTab = (typeof PUBLIC_TABS)[number];

const TABS_POR_ROL: Record<string, readonly PublicTab[]> = {
  master: PUBLIC_TABS,
  reclamos: ["reclamos"],
};

export function tabsPermitidas(role: string): readonly PublicTab[] {
  return TABS_POR_ROL[role] ?? TABS_POR_ROL.reclamos;
}

export function puedeVer(role: string, tab: PublicTab): boolean {
  return tabsPermitidas(role).includes(tab);
}

function parseAccountsEnv(): PublicAccount[] {
  const raw = process.env.PUBLIC_ACCOUNTS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [user, pass, role] = entry.split(":");
      return { user, pass, role };
    })
    .filter((a): a is PublicAccount => Boolean(a.user && a.pass && a.role));
}

export function getPublicAccounts(): PublicAccount[] {
  const accounts: PublicAccount[] = [];

  const masterUser = process.env.MASTER_USER;
  const masterPass = process.env.MASTER_PASS;
  if (masterUser && masterPass) {
    accounts.push({ user: masterUser, pass: masterPass, role: "master" });
  }

  accounts.push(...parseAccountsEnv());
  return accounts;
}
