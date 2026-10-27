"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, Download, ExternalLink, Heart, ImageIcon, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api, errorMessage } from "@/lib/client-api";
import { formatBytes, formatDate, formatDuration, relativeTime } from "@/lib/utils";
import type { Asset } from "@/lib/types";

export function AssetLightbox({
  asset,
  open,
  onOpenChange,
  onChanged,
  onUseReference,
  trash = false,
}: {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
  onUseReference?: (asset: Asset) => void;
  trash?: boolean;
}) {
  const [favorite, setFavorite] = React.useState(asset?.favorite ?? false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setFavorite(asset?.favorite ?? false);
  }, [asset]);

  if (!asset) return null;

  async function toggleFavorite() {
    if (!asset) return;
    setBusy(true);
    try {
      const result = await api<{ asset: Asset }>(`/api/assets/${asset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ favorite: !favorite }),
      });
      setFavorite(result.asset.favorite);
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!asset) return;
    setBusy(true);
    try {
      await api(`/api/assets/${asset.id}${trash ? "?permanent=1" : ""}`, { method: "DELETE" });
      toast.success(trash ? "Asset permanently deleted." : "Asset moved to trash.");
      onOpenChange(false);
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  async function restore() {
    if (!asset) return;
    setBusy(true);
    try {
      await api(`/api/assets/${asset.id}/restore`, { method: "POST" });
      toast.success("Asset restored.");
      onOpenChange(false);
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  async function copyPrompt() {
    if (!asset?.prompt) return;
    try {
      await navigator.clipboard.writeText(asset.prompt);
      toast.success("Prompt copied.");
    } catch {
      toast.error("Could not access the clipboard.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-5xl overflow-y-auto p-0 lg:grid lg:grid-cols-[1fr_320px] lg:overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{asset.title}</DialogTitle>
          <DialogDescription>Asset details and actions</DialogDescription>
        </DialogHeader>
        <div className="relative flex min-h-[280px] items-center justify-center bg-[#0b0b10] p-3 sm:p-5">
          <div className="max-h-[74dvh] w-full overflow-hidden rounded-xl">
            {asset.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.url ?? ""}
                alt={asset.title}
                className="mx-auto max-h-[70dvh] w-auto max-w-full rounded-lg object-contain"
              />
            ) : (
              <video
                src={asset.url ?? ""}
                poster={asset.thumbnailUrl ?? undefined}
                controls
                autoPlay
                playsInline
                className="mx-auto max-h-[70dvh] w-full rounded-lg object-contain"
              />
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col border-t border-border lg:border-l lg:border-t-0">
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold tracking-tight">{asset.title}</h2>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {relativeTime(asset.createdAt)} · {asset.source}
                </p>
              </div>
              <Badge variant="outline" className="capitalize">
                {asset.kind}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-muted/30 p-3 text-[10px]">
              <div>
                <p className="text-muted-foreground">Dimensions</p>
                <p className="mt-0.5 font-medium">
                  {asset.width && asset.height ? `${asset.width} × ${asset.height}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Aspect</p>
                <p className="mt-0.5 font-medium">{asset.aspectRatio ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Size</p>
                <p className="mt-0.5 font-medium">{formatBytes(asset.sizeBytes)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="mt-0.5 font-medium">
                  {asset.kind === "video" ? formatDuration(asset.durationSeconds) : "Still"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Model</p>
                <p className="mt-0.5 truncate font-medium">{asset.model ?? "Uploaded"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Folder</p>
                <p className="mt-0.5 truncate font-medium">{asset.folder}</p>
              </div>
            </div>

            {asset.prompt ? (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Prompt
                  </p>
                  <button
                    onClick={copyPrompt}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="size-3" /> Copy
                  </button>
                </div>
                <p className="mt-1.5 max-h-36 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border/70 bg-card p-3 text-xs leading-relaxed text-foreground/85">
                  {asset.prompt}
                </p>
              </div>
            ) : null}

            {asset.negativePrompt ? (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Negative prompt
                </p>
                <p className="mt-1.5 whitespace-pre-wrap rounded-xl border border-border/70 bg-card p-3 text-xs leading-relaxed text-foreground/85">
                  {asset.negativePrompt}
                </p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-1.5">
              {asset.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[9px]">
                  {tag}
                </Badge>
              ))}
              {asset.isExample ? (
                <Badge variant="warning" className="text-[9px]">
                  Example asset
                </Badge>
              ) : null}
            </div>
            <p className="mt-4 text-[10px] text-muted-foreground">Added {formatDate(asset.createdAt)}</p>
          </div>

          <Separator />
          <div className="flex flex-wrap items-center gap-2 p-4">
            {!trash ? (
              <Button variant="outline" size="sm" onClick={toggleFavorite} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Heart className={favorite ? "fill-current text-rose-500" : ""} />}
                {favorite ? "Favorited" : "Favorite"}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={restore} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />} Restore
              </Button>
            )}
            {asset.url ? (
              <Button asChild variant="outline" size="sm">
                <a href={asset.url} download target="_blank" rel="noreferrer">
                  <Download /> Download
                </a>
              </Button>
            ) : null}
            {onUseReference && !trash ? (
              <Button
                size="sm"
                onClick={() => {
                  onUseReference(asset);
                  onOpenChange(false);
                }}
              >
                <ImageIcon /> Use as reference
              </Button>
            ) : null}
            {asset.projectId ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/projects/${asset.projectId}`}>
                  <ExternalLink /> Project
                </Link>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-destructive hover:text-destructive"
              onClick={remove}
              disabled={busy}
            >
              <Trash2 /> {trash ? "Delete forever" : "Delete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
