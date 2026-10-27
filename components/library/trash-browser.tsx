"use client";

import * as React from "react";
import Link from "next/link";
import { FolderKanban, Images, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AssetCard } from "@/components/media/asset-card";
import { AssetLightbox } from "@/components/media/asset-lightbox";
import { ProjectCard } from "@/components/studio/project-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, errorMessage } from "@/lib/client-api";
import type { Asset, ProjectSummary } from "@/lib/types";

interface ProjectListResponse {
  items: ProjectSummary[];
  total: number;
  page: number;
  pageSize: number;
}

interface AssetListResponse {
  items: Asset[];
  total: number;
  page: number;
  pageSize: number;
}

export function TrashBrowser({
  initialProjects,
  initialAssets,
}: {
  initialProjects: ProjectListResponse;
  initialAssets: AssetListResponse;
}) {
  const [projects, setProjects] = React.useState(initialProjects);
  const [assets, setAssets] = React.useState(initialAssets);
  const [loading, setLoading] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<Asset | null>(null);
  const [emptyOpen, setEmptyOpen] = React.useState(false);
  const [emptying, setEmptying] = React.useState(false);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const [projectResult, assetResult] = await Promise.all([
        api<ProjectListResponse>("/api/projects?trash=1&pageSize=48"),
        api<AssetListResponse>("/api/assets?trash=1&pageSize=48"),
      ]);
      setProjects(projectResult);
      setAssets(assetResult);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  async function emptyTrash() {
    setEmptying(true);
    try {
      await Promise.all([
        ...projects.items.map((project) =>
          api(`/api/projects/${project.id}?permanent=1`, { method: "DELETE" }),
        ),
        ...assets.items.map((asset) => api(`/api/assets/${asset.id}?permanent=1`, { method: "DELETE" })),
      ]);
      toast.success("Trash emptied. Deleted media cannot be recovered.");
      setEmptyOpen(false);
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setEmptying(false);
    }
  }

  const total = projects.total + assets.total;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-300">
            <Trash2 className="size-3.5" />
          </span>
          <div>
            <p className="text-xs font-semibold">Items in trash stay recoverable until deleted forever.</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
              Restore anything you still need. Permanent deletion also removes the stored media file.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-destructive/25 text-destructive hover:bg-destructive/5"
          disabled={total === 0 || loading}
          onClick={() => setEmptyOpen(true)}
        >
          <Trash2 /> Empty trash
        </Button>
      </div>

      <Tabs defaultValue="projects">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="projects">
              <FolderKanban /> Projects
              <span className="rounded bg-muted px-1 text-[9px]">{projects.total}</span>
            </TabsTrigger>
            <TabsTrigger value="media">
              <Images /> Media
              <span className="rounded bg-muted px-1 text-[9px]">{assets.total}</span>
            </TabsTrigger>
          </TabsList>
          {loading ? (
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Refreshing
            </span>
          ) : null}
        </div>

        <TabsContent value="projects">
          {projects.items.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {projects.items.map((project) => (
                <ProjectCard key={project.id} project={project} trash onChanged={() => void reload()} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FolderKanban}
              title="No projects in trash"
              description="Projects you delete move here first, so you can restore them or remove them for good."
              action={
                <Button asChild variant="outline">
                  <Link href="/projects">
                    <RotateCcw /> Back to projects
                  </Link>
                </Button>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="media">
          {assets.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {assets.items.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  trash
                  onOpen={setLightbox}
                  onChanged={() => void reload()}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Images}
              title="No media in trash"
              description="Deleted frames and clips stay here until you restore them or delete them forever."
              action={
                <Button asChild variant="outline">
                  <Link href="/media">
                    <RotateCcw /> Back to media
                  </Link>
                </Button>
              }
            />
          )}
        </TabsContent>
      </Tabs>

      <AssetLightbox
        asset={lightbox}
        open={lightbox !== null}
        trash
        onOpenChange={(open) => (!open ? setLightbox(null) : undefined)}
        onChanged={() => void reload()}
      />

      <AlertDialog open={emptyOpen} onOpenChange={setEmptyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty the trash?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {projects.total} {projects.total === 1 ? "project" : "projects"} and{" "}
              {assets.total} {assets.total === 1 ? "asset" : "assets"}, including their stored files. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={emptying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void emptyTrash();
              }}
              disabled={emptying}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {emptying ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
