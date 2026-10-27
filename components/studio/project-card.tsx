"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clapperboard,
  Copy,
  ExternalLink,
  Heart,
  ImageIcon,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectStatusBadge } from "@/components/studio/status-badge";
import { api, errorMessage } from "@/lib/client-api";
import { cn, relativeTime } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/types";

const MODE_ICONS = {
  video: Clapperboard,
  image: ImageIcon,
  storyboard: LayoutTemplate,
};

export function ProjectCard({
  project,
  onChanged,
  onRename,
  trash = false,
  className,
}: {
  project: ProjectSummary;
  onChanged?: () => void;
  onRename?: (project: ProjectSummary) => void;
  trash?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const ModeIcon = MODE_ICONS[project.mode] ?? Clapperboard;

  async function toggleFavorite(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await api(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ favorite: !project.favorite }),
      });
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function duplicate(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setBusy(true);
    try {
      const result = await api<{ project: { id: string } }>(`/api/projects/${project.id}/duplicate`, {
        method: "POST",
      });
      toast.success("Project duplicated.");
      router.push(`/projects/${result.project.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  async function remove(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await api(`/api/projects/${project.id}${trash ? "?permanent=1" : ""}`, { method: "DELETE" });
      toast.success(trash ? "Project permanently deleted." : "Project moved to trash.");
      onChanged?.();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function restore(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await api(`/api/projects/${project.id}/restore`, { method: "POST" });
      toast.success("Project restored.");
      onChanged?.();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-[1.7rem] border-border/60 bg-card p-0 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/20",
        busy && "opacity-60",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#0c0c0e]">
        <Link
          href={`/projects/${project.id}`}
          className="absolute inset-0 z-0 block"
          aria-label={`Open ${project.title}`}
        >
          {project.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="grid size-full place-items-center bg-[radial-gradient(500px_300px_at_30%_20%,rgba(138,180,248,0.14),transparent_70%),linear-gradient(160deg,#151518,#0b0b0c)]">
              <span className="flex flex-col items-center gap-2 text-white/40">
                <ModeIcon className="size-7" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.22em]">
                  {project.mode}
                </span>
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />
          {project.mode === "video" && project.coverUrl ? (
            <span className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white/90 opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
              <Play className="ml-0.5 size-4 fill-current" />
            </span>
          ) : null}
        </Link>

        <div className="pointer-events-none absolute left-3 right-24 top-3 z-10 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="secondary"
            className="border border-white/10 bg-black/35 text-[8px] uppercase tracking-[0.12em] text-white/85 backdrop-blur-md"
          >
            <ModeIcon className="size-2.5" />
            {project.mode}
          </Badge>
          {project.isExample ? (
            <Badge
              variant="secondary"
              className="border border-white/10 bg-black/35 text-[8px] text-white/80 backdrop-blur-md"
            >
              Sample
            </Badge>
          ) : null}
        </div>

        <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
          {!trash ? (
            <button
              onClick={toggleFavorite}
              className={cn(
                "flex size-8 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-md transition-colors hover:bg-black/55 hover:text-white",
                project.favorite && "text-rose-300",
              )}
              aria-label={project.favorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart className={cn("size-3.5", project.favorite && "fill-current")} />
            </button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8 rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-md hover:bg-black/55 hover:text-white"
                aria-label={`Actions for ${project.title}`}
                disabled={busy}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {trash ? (
                <>
                  <DropdownMenuItem onSelect={(event) => void restore(event as unknown as React.MouseEvent)}>
                    <ExternalLink /> Restore project
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(event) => void remove(event as unknown as React.MouseEvent)}
                  >
                    <Trash2 /> Delete forever
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/${project.id}`}>
                      <ExternalLink /> Open project
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onRename?.(project)}>
                    <Pencil /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(event) => void duplicate(event as unknown as React.MouseEvent)}>
                    <Copy /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(event) => void remove(event as unknown as React.MouseEvent)}
                  >
                    <Trash2 /> Move to trash
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 text-white">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/projects/${project.id}`} className="pointer-events-auto block">
                <h3 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-white transition-opacity hover:opacity-80">
                  {project.title}
                </h3>
              </Link>
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/55">
                <span>{project.sceneCount} {project.sceneCount === 1 ? "scene" : "scenes"}</span>
                <span className="size-0.5 rounded-full bg-white/35" />
                <span>{project.aspectRatio}</span>
                <span className="size-0.5 rounded-full bg-white/35" />
                <span suppressHydrationWarning>{relativeTime(project.updatedAt)}</span>
              </div>
            </div>
            <ProjectStatusBadge
              status={project.status}
              className="shrink-0 border-white/10 bg-black/30 px-2 py-0.5 text-[8px] text-white/80 backdrop-blur-md"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
