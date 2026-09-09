// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import { COOKIE_PATH } from "@/lib/rutas";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Sin esto la sesión se escribe en `Path=/` y viaja en cada request del
    // Portal, con el que compartimos origen. Ver `COOKIE_PATH`.
    { cookieOptions: { path: COOKIE_PATH } }
  );
}
