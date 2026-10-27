"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Clapperboard,
  ImagePlus,
  LayoutTemplate,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectMode } from "@/lib/types";

const MODES: Array<{ id: ProjectMode; label: string; icon: typeof Clapperboard; hint: string }> = [
  { id: "video", label: "Video", icon: Clapperboard, hint: "A slow dolly through a rain-soaked neon alley…" },
  { id: "image", label: "Image", icon: ImagePlus, hint: "Editorial portrait in warm concrete light…" },
  { id: "storyboard", label: "Storyboard", icon: LayoutTemplate, hint: "A three-scene travel diary at golden hour…" },
];

const SUGGESTIONS = [
  "A rain-soaked Tokyo alley at night, neon reflections, slow push-in, anamorphic flare",
  "Editorial portrait in a warm concrete studio, single softbox, medium format",
  "A three-scene travel diary along a coastal road at golden hour",
];

export function HomeComposer({ hasModels }: { hasModels: boolean }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<ProjectMode>("video");
  const [prompt, setPrompt] = React.useState("");
  const active = MODES.find((item) => item.id === mode) ?? MODES[0];

  function start() {
    const params = new URLSearchParams({ mode });
    if (prompt.trim()) params.set("prompt", prompt.trim());
    router.push(`/create?${params.toString()}`);
  }

  return (
    <div className="flow-dock relative overflow-hidden rounded-[1.9rem] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Tabs value={mode} onValueChange={(value) => setMode(value as ProjectMode)}>
          <TabsList className="h-9">
            {MODES.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="gap-1.5 px-3">
                <item.icon className="size-3.5" />
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Badge variant={hasModels ? "success" : "warning"} className="text-[9px]">
          <span className={cn("size-1.5 rounded-full", hasModels ? "bg-emerald-500" : "bg-amber-500")} />
          {hasModels ? "Models online" : "Setup mode"}
        </Badge>
      </div>

      <div className="relative mt-3">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              start();
            }
          }}
          rows={3}
          maxLength={4000}
          placeholder={active.hint}
          aria-label="Describe your idea"
          className="min-h-[104px] w-full resize-none rounded-[1.35rem] border border-transparent bg-muted/35 px-4 py-3.5 pr-14 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/65 focus-visible:border-ring/40 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/15"
        />
        <Wand2 className="pointer-events-none absolute right-4 top-4 size-4 text-muted-foreground/45" />
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.slice(0, mode === "image" ? 2 : 3).map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setPrompt(suggestion)}
              className="max-w-full truncate rounded-full border border-border/60 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
            >
              {suggestion.slice(0, 44)}…
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Sparkles className="size-3" />
            {mode === "storyboard" ? "Scene list included" : "Estimate shown before you generate"}
          </span>
          <button
            onClick={start}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105"
            aria-label={prompt.trim() ? "Open prompt in studio" : "Open the studio"}
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[9px] text-muted-foreground">
        <span>
          {hasModels
            ? "Generation stays server-side. Credits are reserved only when you generate."
            : "Browse, storyboard and upload now. Add a provider key to turn on generation."}
        </span>
        <span className="hidden items-center gap-1 sm:flex">
          <kbd className="rounded border border-border bg-muted px-1 py-0.5">⌘</kbd>
          <kbd className="rounded border border-border bg-muted px-1 py-0.5">↵</kbd>
        </span>
      </div>
    </div>
  );
}
