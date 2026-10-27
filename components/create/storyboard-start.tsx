"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clapperboard,
  GripVertical,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { STYLE_PRESETS } from "@/lib/config";
import { api, errorMessage } from "@/lib/client-api";
import type { ProjectDetail, Template, TemplateScene } from "@/lib/types";

export function StoryboardStart({
  initialPrompt,
  template,
}: {
  initialPrompt: string;
  template?: Template | null;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(template?.title ?? "");
  const [prompt, setPrompt] = React.useState(initialPrompt || template?.prompt || "");
  const [aspectRatio, setAspectRatio] = React.useState(template?.aspectRatio ?? "16:9");
  const [stylePreset, setStylePreset] = React.useState(template?.stylePreset ?? "cinematic");
  const [loading, setLoading] = React.useState(false);
  const [scenes, setScenes] = React.useState<TemplateScene[]>(() => {
    if (template?.scenes && template.scenes.length > 0) return template.scenes;
    return [
      {
        title: "Scene 1",
        prompt: initialPrompt || template?.prompt || "Your opening scene",
        durationSeconds: 10,
      },
    ];
  });

  function updateScene(index: number, patch: Partial<TemplateScene>) {
    setScenes((current) =>
      current.map((scene, sceneIndex) => (sceneIndex === index ? { ...scene, ...patch } : scene)),
    );
  }

  function addScene() {
    setScenes((current) => [
      ...current,
      {
        title: `Scene ${current.length + 1}`,
        prompt: "",
        durationSeconds: 10,
      },
    ]);
  }

  function removeScene(index: number) {
    setScenes((current) => {
      if (current.length <= 1) return current;
      return current
        .filter((_, sceneIndex) => sceneIndex !== index)
        .map((scene, sceneIndex) => ({
          ...scene,
          title: scene.title.trim() || `Scene ${sceneIndex + 1}`,
        }));
    });
  }

  async function create() {
    if (!prompt.trim()) {
      toast.error("Describe the sequence first.");
      return;
    }
    setLoading(true);
    try {
      const projectTitle =
        title.trim() ||
        prompt.trim().split(/[.!?\n]/)[0]?.slice(0, 70) ||
        "Untitled storyboard";
      const result = await api<{ project: ProjectDetail }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          title: projectTitle,
          description: "Storyboard created in Whisk Flow.",
          mode: "storyboard",
          aspectRatio,
          prompt,
          templateSlug: template?.slug ?? null,
          settings: { stylePreset },
          scenes: scenes.map((scene, index) => ({
            title: scene.title.trim() || `Scene ${index + 1}`,
            prompt: scene.prompt.trim() || prompt,
            durationSeconds: scene.durationSeconds || 10,
          })),
        }),
      });
      toast.success("Storyboard created. Shape it scene by scene.");
      router.push(`/projects/${result.project.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Card className="h-fit p-5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layers className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">New storyboard</p>
            <p className="text-[10px] text-muted-foreground">A project with scenes, order and a timeline.</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="storyboard-title">Project title</Label>
            <Input
              id="storyboard-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled storyboard"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="storyboard-prompt">Sequence idea</Label>
            <Textarea
              id="storyboard-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="A documentary travel sequence along a coastal road at golden hour…"
            />
            <p className="text-[10px] text-muted-foreground">
              This becomes the project brief. Each scene gets its own editable prompt.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="storyboard-aspect">Aspect ratio</Label>
              <Select
                id="storyboard-aspect"
                value={aspectRatio}
                onChange={(event) => setAspectRatio(event.target.value)}
              >
                {["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"].map((ratio) => (
                  <option key={ratio} value={ratio}>
                    {ratio}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="storyboard-style">Style</Label>
              <Select
                id="storyboard-style"
                value={stylePreset}
                onChange={(event) => setStylePreset(event.target.value)}
              >
                {STYLE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button className="w-full" size="lg" onClick={create} loading={loading}>
            {loading ? <Loader2 /> : <Clapperboard />}
            Create storyboard
            {!loading ? <ArrowRight /> : null}
          </Button>
          <p className="text-center text-[10px] text-muted-foreground">
            No provider key needed to build the board. Generate frames when a model is connected.
          </p>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-primary" />
            <p className="text-xs font-semibold">
              {template ? `Template · ${template.title}` : "Scene plan"}
            </p>
          </div>
          <Badge variant="outline">{scenes.length} scenes</Badge>
        </div>
        <div className="space-y-2 p-3">
          {scenes.map((scene, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-3"
            >
              <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-semibold text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Input
                    value={scene.title}
                    onChange={(event) => updateScene(index, { title: event.target.value })}
                    className="h-8 flex-1 border-transparent bg-transparent px-1 text-xs font-semibold shadow-none focus-visible:border-input"
                    maxLength={120}
                    aria-label={`Scene ${index + 1} title`}
                  />
                  <span className="shrink-0 text-[9px] text-muted-foreground">
                    {scene.durationSeconds}s
                  </span>
                </div>
                <Textarea
                  value={scene.prompt}
                  onChange={(event) => updateScene(index, { prompt: event.target.value })}
                  rows={2}
                  className="min-h-0 resize-none border-transparent bg-transparent px-1 py-1 text-[10px] leading-relaxed shadow-none focus-visible:border-input"
                  maxLength={4000}
                  placeholder="Describe this scene…"
                  aria-label={`Scene ${index + 1} prompt`}
                />
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <GripVertical className="size-3.5 text-muted-foreground/40" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeScene(index)}
                  disabled={scenes.length <= 1}
                  aria-label={`Remove scene ${index + 1}`}
                  className="text-muted-foreground/60 hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          <button
            onClick={addScene}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
          >
            <Plus className="size-3" /> Add a scene
          </button>
        </div>
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            You will be able to reorder, duplicate, delete, generate and replace each scene in the
            project workspace. Every scene autosaves.
          </p>
        </div>
      </Card>
    </div>
  );
}
