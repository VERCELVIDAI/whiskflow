"use client";

import * as React from "react";
import {
  Check,
  Folder,
  FolderPlus,
  Heart,
  Images,
  Loader2,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AssetCard } from "@/components/media/asset-card";
import { AssetLightbox } from "@/components/media/asset-lightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { api, errorMessage } from "@/lib/client-api";
import { ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { Asset, AssetKind } from "@/lib/types";

interface AssetListResponse {
  items: Asset[];
  total: number;
  page: number;
  pageSize: number;
}

type FolderSummary = { folder: string; count: number };

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function validateFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type) && !ALLOWED_VIDEO_TYPES.has(file.type)) {
    return `${file.name} is not a supported image or video.`;
  }
  const limit = ALLOWED_IMAGE_TYPES.has(file.type) ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > limit) {
    return `${file.name} is larger than the ${Math.round(limit / 1024 / 1024)} MB limit.`;
  }
  return null;
}

export function MediaLibrary({
  initialData,
  initialFolders,
  initialFavorites = false,
}: {
  initialData: AssetListResponse;
  initialFolders: FolderSummary[];
  initialFavorites?: boolean;
}) {
  const [data, setData] = React.useState(initialData);
  const [folders, setFolders] = React.useState(initialFolders);
  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState<AssetKind | "all">("all");
  const [folder, setFolder] = React.useState<string | null>(null);
  const [favorites, setFavorites] = React.useState(initialFavorites);
  const [sort, setSort] = React.useState<"newest" | "oldest" | "title">("newest");
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<Asset | null>(null);
  const [selectMode, setSelectMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [moving, setMoving] = React.useState<Asset | null>(null);
  const [moveFolder, setMoveFolder] = React.useState("");
  const [moveBusy, setMoveBusy] = React.useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dragDepth = React.useRef(0);
  const firstRender = React.useRef(true);

  const load = React.useCallback(
    async (nextPage = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: "24",
          sort,
        });
        if (query.trim()) params.set("search", query.trim());
        if (kind !== "all") params.set("kind", kind);
        if (folder) params.set("folder", folder);
        if (favorites) params.set("favorites", "1");
        const [result, folderResult] = await Promise.all([
          api<AssetListResponse>(`/api/assets?${params.toString()}`),
          api<{ folders: FolderSummary[] }>("/api/assets/folders"),
        ]);
        setData(result);
        setFolders(folderResult.folders);
        setSelected(new Set());
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [favorites, folder, kind, query, sort],
  );

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => void load(1), 260);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, kind, folder, favorites, sort]);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    const problem = list.map(validateFile).find(Boolean);
    if (problem) {
      toast.error(problem);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      for (const file of list.slice(0, 8)) form.append("files", file);
      form.set("folder", folder ?? "Uploads");
      await api<{ assets: Asset[] }>("/api/assets/upload", { method: "POST", body: form });
      toast.success(`${Math.min(list.length, 8)} ${list.length === 1 ? "file" : "files"} uploaded.`);
      await load(1);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function toggleSelected(asset: Asset) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(asset.id)) next.delete(asset.id);
      else next.add(asset.id);
      return next;
    });
  }

  function openMove(asset: Asset) {
    setMoving(asset);
    setMoveFolder(asset.folder);
  }

  async function saveMove() {
    const target = moving;
    if (!target) return;
    const nextFolder = moveFolder.trim();
    if (!nextFolder) {
      toast.error("Choose or name a folder.");
      return;
    }
    setMoveBusy(true);
    try {
      await api(`/api/assets/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({ folder: nextFolder.slice(0, 60) }),
      });
      toast.success("Asset moved.");
      setMoving(null);
      await load(data.page);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setMoveBusy(false);
    }
  }

  async function moveSelected() {
    const nextFolder = moveFolder.trim();
    if (!nextFolder) {
      toast.error("Choose or name a folder.");
      return;
    }
    setMoveBusy(true);
    try {
      await Promise.all(
        [...selected].map((id) =>
          api(`/api/assets/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ folder: nextFolder.slice(0, 60) }),
          }),
        ),
      );
      toast.success(`${selected.size} ${selected.size === 1 ? "asset" : "assets"} moved.`);
      setBulkMoveOpen(false);
      setSelectMode(false);
      await load(data.page);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setMoveBusy(false);
    }
  }

  async function trashSelected() {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      await Promise.all([...selected].map((id) => api(`/api/assets/${id}`, { method: "DELETE" })));
      toast.success(`${selected.size} ${selected.size === 1 ? "asset" : "assets"} moved to trash.`);
      setSelectMode(false);
      await load(1);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const hasFilters = Boolean(query.trim()) || kind !== "all" || Boolean(folder) || favorites;
  const allFolders = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of folders) map.set(item.folder, item.count);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [folders]);

  return (
    <div
      className="relative"
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        if (event.dataTransfer.types.includes("Files")) setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (event.dataTransfer.files.length > 0) void upload(event.dataTransfer.files);
      }}
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/50 p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search media by title, prompt or folder…"
              className="h-9 pl-8 text-xs"
              aria-label="Search media"
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
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Select
              value={kind}
              onChange={(event) => setKind(event.target.value as AssetKind | "all")}
              aria-label="Filter by media type"
              className="h-9 min-w-[120px]"
            >
              <option value="all">All types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
            </Select>
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as "newest" | "oldest" | "title")}
              aria-label="Sort media"
              className="h-9 min-w-[130px]"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A–Z</option>
            </Select>
            <button
              onClick={() => setFavorites((value) => !value)}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card/70 px-3 text-[10px] font-medium transition-colors",
                favorites ? "border-rose-300 bg-rose-500/10 text-rose-600 dark:text-rose-300" : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={favorites}
            >
              <Heart className={cn("size-3.5", favorites && "fill-current")} /> Favorites
            </button>
            <Button variant="outline" size="sm" onClick={() => setSelectMode((value) => !value)}>
              <Check /> {selectMode ? "Done" : "Select"}
            </Button>
            <Button size="sm" onClick={() => inputRef.current?.click()} loading={uploading}>
              {uploading ? <Loader2 /> : <Upload />} Upload
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              className="sr-only"
              onChange={(event) => event.target.files && void upload(event.target.files)}
              aria-label="Upload media"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
          <button
            onClick={() => setFolder(null)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors",
              folder === null ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-pressed={folder === null}
          >
            <Images className="size-3" /> All media
          </button>
          {allFolders.map(([name, count]) => (
            <button
              key={name}
              onClick={() => setFolder(name)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors",
                folder === name ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-pressed={folder === name}
            >
              <Folder className="size-3" /> {name}
              <span className="rounded bg-muted px-1 text-[9px] text-muted-foreground">{count}</span>
            </button>
          ))}
          {hasFilters ? (
            <button
              onClick={() => {
                setQuery("");
                setKind("all");
                setFolder(null);
                setFavorites(false);
                setSort("newest");
              }}
              className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" /> Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {selectMode && selected.size > 0 ? (
        <div className="sticky top-2 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-card/95 p-2 shadow-lg backdrop-blur">
          <span className="px-1 text-xs font-semibold">{selected.size} selected</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMoveFolder(folder ?? "Uploads");
              setBulkMoveOpen(true);
            }}
          >
            <FolderPlus /> Move
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void trashSelected()}>
            <Trash2 /> Trash
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" /> Loading media…
            </span>
          ) : (
            <>
              {data.total} {data.total === 1 ? "asset" : "assets"}
              {folder ? ` in ${folder}` : ""}
              {hasFilters ? " matching your filters" : ""}
            </>
          )}
        </p>
        <span className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
          <SlidersHorizontal className="size-3" /> Drag files anywhere to upload
        </span>
      </div>

      {data.items.length > 0 ? (
        <div
          className={cn(
            "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6",
            loading && "opacity-60",
          )}
        >
          {data.items.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onOpen={setLightbox}
              onChanged={() => void load(data.page)}
              selectable={selectMode}
              selected={selected.has(asset.id)}
              onSelect={toggleSelected}
              onMove={openMove}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-4"
          icon={Images}
          title={hasFilters ? "No media matches" : "Your media library is empty"}
          description={
            hasFilters
              ? "Try a different search, type or folder, or turn off favorites."
              : "Upload images and video, or generate your first frame. Everything is stored privately to your account."
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setKind("all");
                  setFolder(null);
                  setFavorites(false);
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => inputRef.current?.click()}>
                <Upload /> Upload media
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
            <Button variant="outline" size="sm" disabled={data.page <= 1 || loading} onClick={() => void load(data.page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={data.page >= totalPages || loading} onClick={() => void load(data.page + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
          <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-primary/40 bg-card px-12 py-10 text-center shadow-2xl">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Upload className="size-5" />
            </span>
            <p className="mt-4 text-sm font-semibold">Drop to upload</p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPEG, PNG, WebP, GIF up to 15 MB · MP4, WebM, MOV up to 100 MB
            </p>
          </div>
        </div>
      ) : null}

      <AssetLightbox
        asset={lightbox}
        open={lightbox !== null}
        onOpenChange={(open) => (!open ? setLightbox(null) : undefined)}
        onChanged={() => void load(data.page)}
      />

      <Dialog open={moving !== null} onOpenChange={(open) => (!open ? setMoving(null) : undefined)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Move asset</DialogTitle>
            <DialogDescription>Organize “{moving?.title}” into a folder.</DialogDescription>
          </DialogHeader>
          <FolderChooser
            folders={allFolders.map(([name]) => name)}
            value={moveFolder}
            onChange={setMoveFolder}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoving(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveMove()} loading={moveBusy} disabled={!moveFolder.trim()}>
              Move asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkMoveOpen} onOpenChange={setBulkMoveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Move {selected.size} assets</DialogTitle>
            <DialogDescription>Choose an existing folder or create a new one.</DialogDescription>
          </DialogHeader>
          <FolderChooser
            folders={allFolders.map(([name]) => name)}
            value={moveFolder}
            onChange={setMoveFolder}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMoveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void moveSelected()} loading={moveBusy} disabled={!moveFolder.trim()}>
              Move assets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FolderChooser({
  folders,
  value,
  onChange,
}: {
  folders: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {folders.map((folder) => (
          <button
            key={folder}
            onClick={() => onChange(folder)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition-colors",
              value === folder
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={value === folder}
          >
            {folder}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-folder">Or name a new folder</Label>
        <Input
          id="new-folder"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="e.g. Chapter one"
          maxLength={60}
        />
      </div>
    </div>
  );
}
