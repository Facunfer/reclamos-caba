// El acceso a /public ya lo garantiza el middleware (cookie de sesión
// firmada, ver src/lib/publicSession.ts) antes de que este layout renderice.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
