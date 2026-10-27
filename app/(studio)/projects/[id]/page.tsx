import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { authMode, requireUser } from "@/lib/auth";
import { getProviderCatalog } from "@/lib/providers/models";
import { getProject } from "@/lib/data/projects";
import { listAssets } from "@/lib/data/assets";
import { ProjectWorkspace } from "@/components/projects/project-workspace";
import { NotFoundError } from "@/lib/errors";

export const metadata: Metadata = { title: "Project" };
export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  let project;
  try {
    project = await getProject(user.id, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const media = await listAssets(user.id, {
    page: 1,
    pageSize: 120,
    search: "",
    sort: "newest",
  });

  return (
    <ProjectWorkspace
      initialProject={project}
      catalog={getProviderCatalog(authMode())}
      mediaAssets={media.items}
    />
  );
}
