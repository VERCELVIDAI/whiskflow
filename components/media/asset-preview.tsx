import { cn } from "@/lib/utils";
import type { Asset } from "@/lib/types";

export function AssetPreview({
  asset,
  className,
  videoControls = false,
  priority = false,
}: {
  asset: Pick<Asset, "kind" | "url" | "thumbnailUrl" | "title" | "mimeType">;
  className?: string;
  videoControls?: boolean;
  priority?: boolean;
}) {
  const src = asset.url;

  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
        <span className="text-[10px] uppercase tracking-wider">No preview</span>
      </div>
    );
  }

  if (asset.kind === "video") {
    return (
      <video
        src={src}
        poster={asset.thumbnailUrl ?? undefined}
        controls={videoControls}
        muted={!videoControls}
        loop={!videoControls}
        playsInline
        preload={videoControls ? "metadata" : "none"}
        aria-label={asset.title}
        className={cn("size-full object-cover", className)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset.thumbnailUrl || src}
      alt={asset.title}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn("size-full object-cover", className)}
    />
  );
}
