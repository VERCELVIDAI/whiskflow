import { cn } from "@/lib/utils";
import type { ProjectStatus, SceneStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const PROJECT_LABELS: Record<ProjectStatus, { label: string; variant: "secondary" | "default" | "success" }> = {
  draft: { label: "Draft", variant: "secondary" },
  in_progress: { label: "In progress", variant: "default" },
  complete: { label: "Complete", variant: "success" },
};

const SCENE_LABELS: Record<SceneStatus, { label: string; variant: "secondary" | "default" | "success" | "warning" | "danger" }> = {
  draft: { label: "Draft", variant: "secondary" },
  queued: { label: "Queued", variant: "warning" },
  generating: { label: "Generating", variant: "default" },
  ready: { label: "Ready", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
};

export function ProjectStatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  const config = PROJECT_LABELS[status];
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

export function SceneStatusBadge({ status, className }: { status: SceneStatus; className?: string }) {
  const config = SCENE_LABELS[status];
  return (
    <Badge variant={config.variant} className={className}>
      {status === "generating" ? (
        <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
      ) : null}
      {config.label}
    </Badge>
  );
}

export function ModeBadge({ mode, className }: { mode: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize", className)}>
      {mode}
    </Badge>
  );
}
