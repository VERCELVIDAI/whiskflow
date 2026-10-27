import type { Metadata } from "next";
import { authMode, requireUser } from "@/lib/auth";
import { getProviderCatalog } from "@/lib/providers/models";
import { storageMode } from "@/lib/storage";
import { PageHeader } from "@/components/studio/page-header";
import { SettingsPanel } from "@/components/settings/settings-panel";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Profile, security, appearance and the integration boundary for AI providers, auth and storage."
      />
      <div className="mt-6">
        <SettingsPanel
          initialUser={user}
          catalog={getProviderCatalog(authMode())}
          storage={storageMode()}
        />
      </div>
    </div>
  );
}
