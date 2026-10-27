import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listAssets } from "@/lib/data/assets";
import { listProjects } from "@/lib/data/projects";
import { PageHeader } from "@/components/studio/page-header";
import { TrashBrowser } from "@/components/library/trash-browser";

export const metadata: Metadata = { title: "Trash" };
export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const user = await requireUser();
  const [projects, assets] = await Promise.all([
    listProjects(user.id, { page: 1, pageSize: 48, search: "", trash: true }),
    listAssets(user.id, { page: 1, pageSize: 48, search: "", trash: true, sort: "newest" }),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Library"
        title="Trash"
        description="A safety net for deleted projects and media. Restore what you need, or clear it out for good."
      />
      <div className="mt-6">
        <TrashBrowser initialProjects={projects} initialAssets={assets} />
      </div>
    </div>
  );
}
