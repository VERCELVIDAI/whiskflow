"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, Images, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { AssetCard } from "@/components/media/asset-card";
import { AssetLightbox } from "@/components/media/asset-lightbox";
import { ProjectCard } from "@/components/studio/project-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export function FavoritesBrowser({
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
  const [renaming, setRenaming] = React.useState<ProjectSummary | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [renamingBusy, setRenamingBusy] = React.useState(false);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const [projectResult, assetResult] = await Promise.all([
        api<ProjectListResponse>("/api/projects?favorites=1&pageSize=48"),
        api<AssetListResponse>("/api/assets?favorites=1&pageSize=48"),
      ]);
      setProjects(projectResult);
      setAssets(assetResult);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  async function saveRename() {
    if (!renaming) return;
    const title = renameValue.trim();
    if (!title) {
      toast.error("Project title cannot be empty.");
      return;
    }
    setRenamingBusy(true);
    try {
      await api(`/api/projects/${renaming.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      toast.success("Project renamed.");
      setRenaming(null);
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRenamingBusy(false);
    }
  }

  return (
    <div>
      <Tabs defaultValue="projects">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="projects">
              <Heart /> Projects
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
                <ProjectCard
                  key={project.id}
                  project={project}
                  onChanged={() => void reload()}
                  onRename={(item) => {
                    setRenaming(item);
                    setRenameValue(item.title);
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Heart}
              title="No favorite projects yet"
              description="Tap the heart on any project to keep it close. Favorites stay in sync across your workspace."
              action={
                <Button asChild>
                  <Link href="/projects">
                    <Plus /> Browse projects
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
                  onOpen={setLightbox}
                  onChanged={() => void reload()}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Images}
              title="No favorite media yet"
              description="Favorite a frame or clip from your library to build a shortlist of the strongest work."
              action={
                <Button asChild>
                  <Link href="/media">
                    <Images /> Open media library
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
        onOpenChange={(open) => (!open ? setLightbox(null) : undefined)}
        onChanged={() => void reload()}
      />

      <Dialog open={renaming !== null} onOpenChange={(open) => (!open ? setRenaming(null) : undefined)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>Give this project a clearer name in your workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="favorite-rename">Project title</Label>
            <Input
              id="favorite-rename"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              maxLength={120}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveRename()} loading={renamingBusy} disabled={!renameValue.trim()}>
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
