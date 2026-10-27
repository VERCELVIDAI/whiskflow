import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listProjects } from "@/lib/data/projects";
import { projectModeSchema } from "@/lib/validation";
import { PageHeader } from "@/components/studio/page-header";
import { ProjectsBrowser } from "@/components/projects/projects-browser";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const rawMode = typeof params.mode === "string" ? params.mode : null;
  const mode = rawMode ? projectModeSchema.safeParse(rawMode).data : undefined;
  const query = typeof params.q === "string" ? params.q.slice(0, 120) : "";
  const favorites = params.favorites === "1";
  const page = Math.max(1, Number(params.page) || 1);

  const data = await listProjects(user.id, {
    page,
    pageSize: 24,
    search: query,
    mode,
    favorites,
  });

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Every video, image and storyboard in one place. Autosaved as you shape the work."
        actions={
          <Button asChild>
            <Link href="/create">
              <Plus /> New project
            </Link>
          </Button>
        }
      />
      <div className="mt-6">
        <ProjectsBrowser
          initialData={data}
          initialQuery={query}
          initialMode={mode ?? "all"}
          initialFavorites={favorites}
        />
      </div>
    </div>
  );
}
