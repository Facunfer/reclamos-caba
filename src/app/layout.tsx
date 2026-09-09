// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reclamos CABA",
  description: "Sistema de gestión de reclamos por comuna – Ciudad de Buenos Aires",
};

/**
 * Viewport.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * `viewportFit: "cover"` y por qué no hay manifest acá
 * ─────────────────────────────────────────────────────────────────────────
 * Esta app NO declara su propio manifest ni su propio service worker, y es a
 * propósito: se sirve bajo `/reclamos` del origen del Portal Territorial, cuya
 * PWA tiene `scope: "/"`. O sea que ya está adentro de la app instalada y
 * hereda su instalabilidad. Un segundo manifest acá competiría con el del
 * Portal por la misma pantalla de inicio y rompería justamente la idea de que
 * esto es "una sola app".
 *
 * Pero el `viewport` sí es de cada documento, no del manifest. Sin
 * `viewportFit: "cover"` las `env(safe-area-inset-*)` de `globals.css` valen 0
 * incluso en un iPhone con notch, y las clases `.safe-*` no aíslan nada: la
 * barra del panel queda debajo del reloj.
 *
 * `maximumScale` se deja libre a propósito. Limitarlo es la forma clásica de
 * "arreglar" el zoom de iOS, y además de romper la accesibilidad de quien
 * necesita agrandar, en las versiones nuevas de Safari ni siquiera funciona.
 * El zoom se resuelve con la regla de 16px de `globals.css`.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
