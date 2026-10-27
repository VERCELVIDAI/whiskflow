import { MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";

export function InspectorEmpty({
  title = "Nothing selected",
  description = "Select a frame, scene or asset to inspect its prompt, settings and actions here.",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="flex size-10 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground">
        <MousePointerClick className="size-4" />
      </span>
      <p className="mt-3 text-xs font-semibold">{title}</p>
      <p className="mt-1 max-w-[190px] text-[11px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
