import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getTemplates } from "@/lib/templates";
import { PageHeader } from "@/components/studio/page-header";
import { TemplatesGallery } from "@/components/templates/templates-gallery";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Templates" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;
  const templates = getTemplates();
  const initialSlug = typeof params.template === "string" ? params.template : null;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Library"
        title="Templates"
        description="Cinematic starting points for video, image and storyboard work. Every prompt, ratio and scene is editable."
        actions={
          <Badge variant="outline" className="text-[10px]">
            {templates.length} starters
          </Badge>
        }
      />
      <div className="mt-6">
        <TemplatesGallery templates={templates} initialSlug={initialSlug} />
      </div>
    </div>
  );
}
