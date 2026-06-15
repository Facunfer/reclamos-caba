import PublicAuthGuard from "@/components/ui/PublicAuthGuard";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicAuthGuard>{children}</PublicAuthGuard>;
}
