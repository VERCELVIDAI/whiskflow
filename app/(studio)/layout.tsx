import { requireUser } from "@/lib/auth";
import { authMode } from "@/lib/auth";
import { getProviderCatalog } from "@/lib/providers/models";
import { SessionProvider } from "@/components/session-provider";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const catalog = getProviderCatalog(authMode());

  return (
    <SessionProvider initialUser={user} initialCatalog={catalog}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
