"use client";

import * as React from "react";
import Link from "next/link";
import { FolderKanban, Loader2, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectCard } from "@/components/studio/project-card";
import { EmptyState } from "@/components/ui/empty-state";
import { api, errorMessage } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import type { ProjectMode, ProjectSummary } from "@/lib/types";

interface ProjectListResponse {
  items: ProjectSummary[];
  total: number;
  page: number;
  pageSize: number;
}

const MODES: Array<{ id: ProjectMode | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "video", label: "Video" },
  { id: "image", label: "Image" },
  { id: "storyboard", label: "Storyboard" },
];

export function ProjectsBrowser({
  initialData,
  initialQuery = "",
  initialMode = "all",
  initialFavorites = false,
}: {
  initialData: ProjectListResponse;
  initialQuery?: string;
  initialMode?: ProjectMode | "all";
  initialFavorites?: boolean;
}) {
  const [data, setData] = React.useState(initialData);
  const [query, setQuery] = React.useState(initialQuery);
  const [mode, setMode] = React.useState<ProjectMode | "all">(initialMode);
  const [favorites, setFavorites] = React.useState(initialFavorites);
  const [page, setPage] = React.useState(initialData.page);
  const [loading, setLoading] = React.useState(false);
  const [renaming, setRenaming] = React.useState<ProjectSummary | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [renamingBusy, setRenamingBusy] = React.useState(false);
  const firstRender = React.useRef(true);

  const load = React.useCallback(
    async (nextPage = page) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: "24",
        });
        if (query.trim()) params.set("search", query.trim());
        if (mode !== "all") params.set("mode", mode);
        if (favorites) params.set("favorites", "1");
        const result = await api<ProjectListResponse>(`/api/projects?${params.toString()}`);
        setData(result);
        setPage(result.page);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [favorites, mode, page, query],
  );

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => void load(1), 260);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mode, favorites]);

  function openRename(project: ProjectSummary) {
    setRenaming(project);
    setRenameValue(project.title);
  }

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
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRenamingBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const hasFilters = Boolean(query.trim()) || mode !== "all" || favorites;

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-border/60 bg-card/40 p-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects by title or description…"
            className="h-9 pl-8 text-xs"
            aria-label="Search projects"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {MODES.map((item) => (
            <button
              key={item.id}
              onClick={() => setMode(item.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[10px] font-medium transition-colors",
                mode === item.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-pressed={mode === item.id}
            >
              {item.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            onClick={() => setFavorites((value) => !value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[10px] font-medium transition-colors",
              favorites ? "bg-rose-500/10 text-rose-600 dark:text-rose-300" : "text-muted-foreground hover:bg-muted",
            )}
            aria-pressed={favorites}
          >
            Favorites
          </button>
          {hasFilters ? (
            <button
              onClick={() => {
                setQuery("");
                setMode("all");
                setFavorites(false);
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" /> Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" /> Loading projects…
            </span>
          ) : (
            <>
              {data.total} {data.total === 1 ? "project" : "projects"}
              {hasFilters ? " matching your filters" : ""}
            </>
          )}
        </p>
        <span className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
          <SlidersHorizontal className="size-3" /> Newest activity first
        </span>
      </div>

      {data.items.length > 0 ? (
        <div className={cn("mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3", loading && "opacity-60")}>
          {data.items.map((project) => (
            <ProjectCard key={project.id} project={project} onChanged={() => void load()} onRename={openRename} />
          ))}
          <Link
            href="/create"
            className="group flex min-h-[260px] flex-col items-center justify-center rounded-[1.7rem] border border-dashed border-border/80 bg-card/25 p-4 text-center transition-colors hover:border-foreground/25 hover:bg-card/60"
          >
            <span className="flex size-11 items-center justify-center rounded-full border border-border/70 bg-card/70 text-muted-foreground transition-colors group-hover:border-foreground/20 group-hover:text-foreground">
              <Plus className="size-4" />
            </span>
            <span className="mt-3 text-xs font-semibold">New project</span>
            <span className="mt-0.5 text-[10px] text-muted-foreground">Video, image or storyboard</span>
          </Link>
        </div>
      ) : (
        <EmptyState
          className="mt-4"
          icon={FolderKanban}
          title={hasFilters ? "No projects match" : "Your first project starts here"}
          description={
            hasFilters
              ? "Try a different search, mode or turn off the favorites filter."
              : "Create a video, image or storyboard project. Prompts, scenes and references stay together."
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setMode("all");
                  setFavorites(false);
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button asChild>
                <Link href="/create">
                  <Plus /> Create a project
                </Link>
              </Button>
            )
          }
        />
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            Page {data.page} of {totalPages}
          </p>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1 || loading}
              onClick={() => void load(data.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= totalPages || loading}
              onClick={() => void load(data.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={renaming !== null} onOpenChange={(open) => (!open ? setRenaming(null) : undefined)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>Give this project a clearer name in your workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-project">Project title</Label>
            <Input
              id="rename-project"
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
