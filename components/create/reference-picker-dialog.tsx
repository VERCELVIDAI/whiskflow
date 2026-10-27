"use client";

import * as React from "react";
import { Check, ImagePlus, Loader2, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { AssetPreview } from "@/components/media/asset-preview";
import { api, errorMessage } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import type { Asset } from "@/lib/types";

export function ReferencePickerDialog({
  open,
  onOpenChange,
  assets,
  onUploaded,
  onConfirm,
  multiple = true,
  max = 8,
  title = "Choose references",
  description = "Select images from your library or upload new ones.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: Asset[];
  onUploaded: (assets: Asset[]) => void;
  onConfirm: (assets: Asset[]) => void;
  multiple?: boolean;
  max?: number;
  title?: string;
  description?: string;
}) {
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setSelected([]);
      setSearch("");
    }
  }, [open]);

  const imageAssets = assets.filter((asset) => asset.kind === "image");
  const filtered = imageAssets.filter((asset) =>
    `${asset.title} ${asset.folder} ${asset.prompt ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  function toggle(asset: Asset) {
    if (!multiple) {
      setSelected([asset.id]);
      return;
    }
    setSelected((current) => {
      if (current.includes(asset.id)) return current.filter((id) => id !== asset.id);
      if (current.length >= max) {
        toast.error(`Choose up to ${max} references.`);
        return current;
      }
      return [...current, asset.id];
    });
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const form = new FormData();
    Array.from(files).slice(0, 4).forEach((file) => form.append("files", file));
    form.append("folder", "Uploads");
    try {
      const result = await api<{ assets: Asset[] }>("/api/assets/upload", {
        method: "POST",
        body: form,
      });
      onUploaded(result.assets);
      const imageIds = result.assets.filter((asset) => asset.kind === "image").map((asset) => asset.id);
      if (imageIds.length > 0) {
        setSelected((current) =>
          multiple ? [...current, ...imageIds].slice(0, max) : [imageIds[0]],
        );
      }
      toast.success(`${result.assets.length} file${result.assets.length === 1 ? "" : "s"} uploaded.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, folder or prompt…"
              className="h-9 pl-8 text-xs"
              aria-label="Search references"
            />
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            onChange={(event) => void upload(event.target.files)}
            aria-label="Upload references"
          />
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} loading={uploading}>
            {uploading ? <Loader2 /> : <Upload />} Upload
          </Button>
        </div>

        <div className="max-h-[46dvh] min-h-[220px] overflow-y-auto pr-1">
          {filtered.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {filtered.map((asset) => {
                const isSelected = selected.includes(asset.id);
                return (
                  <button
                    key={asset.id}
                    onClick={() => toggle(asset)}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-lg border bg-muted text-left transition-all",
                      isSelected ? "border-primary ring-2 ring-primary/30" : "border-border/70 hover:border-primary/30",
                    )}
                    aria-pressed={isSelected}
                    aria-label={`Select ${asset.title}`}
                  >
                    <AssetPreview asset={asset} />
                    <span
                      className={cn(
                        "absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-full border backdrop-blur",
                        isSelected ? "border-primary bg-primary text-white" : "border-white/70 bg-black/25 text-transparent",
                      )}
                    >
                      <Check className="size-3" />
                    </span>
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-3 text-[9px] font-medium text-white">
                      {asset.title}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={ImagePlus}
              title="No reference images"
              description="Upload a JPG, PNG, WebP or GIF up to 15 MB, or generate a frame first."
              compact
              action={
                <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                  <Upload /> Upload an image
                </Button>
              }
            />
          )}
        </div>

        <DialogFooter className="items-center justify-between sm:justify-between">
          <p className="text-[10px] text-muted-foreground">
            {multiple ? `${selected.length} of ${max} selected` : "Choose one image"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={selected.length === 0}
              onClick={() => {
                const chosen = imageAssets.filter((asset) => selected.includes(asset.id));
                onConfirm(chosen);
                onOpenChange(false);
              }}
            >
              <Check /> Use selection
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
