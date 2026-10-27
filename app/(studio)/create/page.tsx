import type { Metadata } from "next";
import { requireUser, authMode } from "@/lib/auth";
import { getProviderCatalog } from "@/lib/providers/models";
import { listAssets } from "@/lib/data/assets";
import { getProject } from "@/lib/data/projects";
import { getTemplate } from "@/lib/templates";
import { CreateStudio } from "@/components/create/create-studio";
import type { Asset, ProjectDetail, ProjectMode } from "@/lib/types";

export const metadata: Metadata = { title: "Create" };
export const dynamic = "force-dynamic";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const catalog = getProviderCatalog(authMode());

  const templateSlug = typeof params.template === "string" ? params.template : null;
  const template = templateSlug ? getTemplate(templateSlug) ?? null : null;
  const requestedMode = typeof params.mode === "string" ? params.mode : null;
  const mode: ProjectMode =
    requestedMode === "image" || requestedMode === "video" || requestedMode === "storyboard"
      ? requestedMode
      : template?.mode ?? "video";
  const prompt =
    typeof params.prompt === "string" ? params.prompt.slice(0, 4000) : template?.prompt ?? "";

  let initialProject: ProjectDetail | null = null;
  if (typeof params.project === "string") {
    try {
      initialProject = await getProject(user.id, params.project);
    } catch {
      initialProject = null;
    }
  }

  const media = await listAssets(user.id, {
    page: 1,
    pageSize: 60,
    search: "",
    sort: "newest",
  });

  const assetMap = new Map<string, Asset>();
  for (const asset of [...(initialProject?.assets ?? []), ...media.items]) {
    assetMap.set(asset.id, asset);
  }

  return (
    <CreateStudio
      catalog={catalog}
      initialAssets={[...assetMap.values()]}
      initialMode={initialProject?.mode ?? mode}
      initialPrompt={initialProject ? initialProject.promptHistory.at(-1) ?? prompt : prompt}
      template={template}
      initialProject={initialProject}
    />
  );
}
