import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listAssets } from "@/lib/data/assets";
import { listProjects } from "@/lib/data/projects";
import { PageHeader } from "@/components/studio/page-header";
import { FavoritesBrowser } from "@/components/library/favorites-browser";

export const metadata: Metadata = { title: "Favorites" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await requireUser();
  const [projects, assets] = await Promise.all([
    listProjects(user.id, { page: 1, pageSize: 48, search: "", favorites: true }),
    listAssets(user.id, { page: 1, pageSize: 48, search: "", favorites: true, sort: "newest" }),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Library"
        title="Favorites"
        description="Your shortlist of projects, frames and clips. Everything here is marked with a heart."
      />
      <div className="mt-6">
        <FavoritesBrowser initialProjects={projects} initialAssets={assets} />
      </div>
    </div>
  );
}
