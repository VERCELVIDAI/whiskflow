"use client";

import { Check, CloudOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function AutosaveIndicator({ state, className }: { state: SaveState; className?: string }) {
  if (state === "idle") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] font-medium",
        state === "error" ? "text-destructive" : "text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {state === "saving" ? <Loader2 className="size-3 animate-spin" /> : null}
      {state === "saved" ? <Check className="size-3 text-emerald-500" /> : null}
      {state === "error" ? <CloudOff className="size-3" /> : null}
      {state === "saving" ? "Saving…" : state === "saved" ? "All changes saved" : "Could not save"}
    </span>
  );
}
