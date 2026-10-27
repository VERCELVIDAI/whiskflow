"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Download, FolderInput, Heart, MoreHorizontal, Play, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDuration, relativeTime } from "@/lib/utils";
import { api, errorMessage } from "@/lib/client-api";
import { AssetPreview } from "@/components/media/asset-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Asset } from "@/lib/types";

export function AssetCard({
  asset,
  onOpen,
  onChanged,
  selected = false,
  onSelect,
  selectable = false,
  onUseReference,
  onMove,
  trash = false,
}: {
  asset: Asset;
  onOpen: (asset: Asset) => void;
  onChanged?: () => void;
  selected?: boolean;
  onSelect?: (asset: Asset) => void;
  selectable?: boolean;
  onUseReference?: (asset: Asset) => void;
  onMove?: (asset: Asset) => void;
  trash?: boolean;
}) {
  const [favorite, setFavorite] = React.useState(asset.favorite);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => setFavorite(asset.favorite), [asset.favorite]);

  async function toggleFavorite(event: React.MouseEvent) {
    event.stopPropagation();
    try {
      const result = await api<{ asset: Asset }>(`/api/assets/${asset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ favorite: !favorite }),
      });
      setFavorite(result.asset.favorite);
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function remove(event: React.MouseEvent) {
    event.stopPropagation();
    setBusy(true);
    try {
      await api(`/api/assets/${asset.id}${trash ? "?permanent=1" : ""}`, { method: "DELETE" });
      toast.success(trash ? "Asset permanently deleted." : "Asset moved to trash.");
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  async function restore(event: React.MouseEvent) {
    event.stopPropagation();
    setBusy(true);
    try {
      await api(`/api/assets/${asset.id}/restore`, { method: "POST" });
      toast.success("Asset restored.");
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/70 bg-card transition-all",
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:border-primary/25",
        busy && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={() => (selectable && onSelect ? onSelect(asset) : onOpen(asset))}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Preview ${asset.title}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <AssetPreview asset={asset} className="transition-transform duration-500 group-hover:scale-[1.025]" />
          {asset.kind === "video" ? (
            <>
              <span className="absolute inset-0 grid place-items-center">
                <span className="flex size-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">
                  <Play className="ml-0.5 size-4 fill-current" />
                </span>
              </span>
              <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur">
                {formatDuration(asset.durationSeconds)}
              </span>
            </>
          ) : null}
          {selectable ? (
            <span
              className={cn(
                "absolute left-2 top-2 flex size-5 items-center justify-center rounded-full border bg-black/35 text-white backdrop-blur",
                selected ? "border-primary bg-primary" : "border-white/60",
              )}
            >
              {selected ? <Check className="size-3" /> : null}
            </span>
          ) : null}
        </div>
      </button>

      {!trash ? (
        <button
          type="button"
          onClick={toggleFavorite}
          className={cn(
            "absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-black/30 text-white opacity-0 backdrop-blur transition-all hover:bg-black/55 group-hover:opacity-100 focus-visible:opacity-100",
            favorite && "text-rose-300 opacity-100",
          )}
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={cn("size-3.5", favorite && "fill-current")} />
        </button>
      ) : null}

      <div className="flex items-start gap-2 p-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold">{asset.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[9px] text-muted-foreground">
            <span className="capitalize">{asset.kind}</span>
            <span>·</span>
            <span suppressHydrationWarning>{relativeTime(asset.createdAt)}</span>
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1 size-7 text-muted-foreground" aria-label="Asset actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {trash ? (
              <>
                <DropdownMenuItem onSelect={() => onOpen(asset)}>
                  <Play /> Preview
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(event) => void restore(event as unknown as React.MouseEvent)}>
                  <RotateCcw /> Restore asset
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(event) => void remove(event as unknown as React.MouseEvent)}>
                  <Trash2 /> Delete forever
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onSelect={() => onOpen(asset)}>
                  <Play /> Preview
                </DropdownMenuItem>
                {onUseReference ? (
                  <DropdownMenuItem onSelect={() => onUseReference(asset)}>
                    <Check /> Use as reference
                  </DropdownMenuItem>
                ) : null}
                {onMove ? (
                  <DropdownMenuItem onSelect={() => onMove(asset)}>
                    <FolderInput /> Move to folder
                  </DropdownMenuItem>
                ) : null}
                {asset.url ? (
                  <DropdownMenuItem asChild>
                    <a href={asset.url} download target="_blank" rel="noreferrer">
                      <Download /> Download
                    </a>
                  </DropdownMenuItem>
                ) : null}
                {asset.projectId ? (
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/${asset.projectId}`}>
                      <Play /> Open project
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(event) => void remove(event as unknown as React.MouseEvent)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {asset.isExample ? (
        <Badge variant="warning" className="absolute left-2 bottom-[4.2rem] text-[8px]">
          Example
        </Badge>
      ) : null}
    </div>
  );
}
