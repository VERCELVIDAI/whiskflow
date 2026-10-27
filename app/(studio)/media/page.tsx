import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listAssetFolders, listAssets } from "@/lib/data/assets";
import { PageHeader } from "@/components/studio/page-header";
import { MediaLibrary } from "@/components/media/media-library";

export const metadata: Metadata = { title: "My media" };
export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const user = await requireUser();
  const [data, folders] = await Promise.all([
    listAssets(user.id, {
      page: 1,
      pageSize: 24,
      search: "",
      sort: "newest",
    }),
    listAssetFolders(user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Library"
        title="My media"
        description="Every frame, clip and reference you have uploaded or generated. Private to your account, organized into folders."
      />
      <div className="mt-6">
        <MediaLibrary initialData={data} initialFolders={folders} />
      </div>
    </div>
  );
}
