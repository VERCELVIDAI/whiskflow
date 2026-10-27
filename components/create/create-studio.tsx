"use client";

import * as React from "react";
import Link from "next/link";
import {
  Aperture,
  ArrowRight,
  Check,
  ChevronDown,
  Clapperboard,
  Coins,
  Copy,
  Download,
  Expand,
  Film,
  ImageIcon,
  ImagePlus,
  Info,
  Layers,
  Loader2,
  Lock,
  Minus,
  MonitorPlay,
  Plus,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSession } from "@/components/session-provider";
import { AutosaveIndicator, type SaveState } from "@/components/studio/autosave-indicator";
import { InspectorEmpty } from "@/components/studio/inspector-empty";
import { AssetPreview } from "@/components/media/asset-preview";
import { AssetLightbox } from "@/components/media/asset-lightbox";
import { PromptAssistantDialog } from "@/components/create/prompt-assistant-dialog";
import { ReferencePickerDialog } from "@/components/create/reference-picker-dialog";
import { StoryboardStart } from "@/components/create/storyboard-start";
import { STYLE_PRESETS } from "@/lib/config";
import { api, ApiError, errorMessage } from "@/lib/client-api";
import {
  cn,
  formatCredits,
  newIdempotencyKey,
  truncate,
} from "@/lib/utils";
import type {
  Asset,
  GenerationJob,
  ProjectDetail,
  ProjectMode,
  ProviderCatalog,
  PublicModel,
  Template,
} from "@/lib/types";

type PickerTarget = "references" | "first" | "last";

interface GenerateResponse {
  job: GenerationJob;
  assets: Asset[];
}

const QUICK_IDEAS = [
  "Golden-hour portrait, soft rim light, 85mm lens",
  "Aerial coastline at dawn, slow forward drift",
  "Product hero on stone, single hard light",
];

function modelForKind(catalog: ProviderCatalog, kind: "image" | "video"): PublicModel | undefined {
  const models = catalog.models.filter((model) => model.kind === kind);
  return models.find((model) => model.available) ?? models[0];
}

function projectTitleFromPrompt(prompt: string): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  const first = clean.split(/[.!?]/)[0] ?? clean;
  return (first || "Untitled creation").slice(0, 80);
}

function stageStyle(aspect: string): React.CSSProperties {
  const [width, height] = aspect.split(":").map(Number);
  const safeWidth = width > 0 ? width : 16;
  const safeHeight = height > 0 ? height : 9;
  return {
    aspectRatio: `${safeWidth} / ${safeHeight}`,
    width: "100%",
    maxWidth: `calc(62dvh * ${safeWidth} / ${safeHeight})`,
    maxHeight: "62dvh",
    marginInline: "auto",
  };
}

export function CreateStudio({
  catalog,
  initialAssets,
  initialMode,
  initialPrompt,
  template,
  initialProject,
}: {
  catalog: ProviderCatalog;
  initialAssets: Asset[];
  initialMode: ProjectMode;
  initialPrompt: string;
  template: Template | null;
  initialProject: ProjectDetail | null;
}) {
  const { user, refresh } = useSession();

  const startingKind = initialMode === "image" ? "image" : "video";
  const startingModel = modelForKind(catalog, startingKind);

  const [mode, setMode] = React.useState<ProjectMode>(initialMode);
  const [prompt, setPrompt] = React.useState(initialPrompt);
  const [modelId, setModelId] = React.useState(startingModel?.id ?? "");
  const [aspectRatio, setAspectRatio] = React.useState(
    template?.aspectRatio ?? (startingKind === "image" ? "1:1" : "16:9"),
  );
  const [resolution, setResolution] = React.useState(startingModel?.resolutions[0] ?? "");
  const [outputCount, setOutputCount] = React.useState(1);
  const [stylePreset, setStylePreset] = React.useState(template?.stylePreset ?? "");
  const [seed, setSeed] = React.useState("");
  const [negativePrompt, setNegativePrompt] = React.useState("");
  const [generateAudio, setGenerateAudio] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  const [assets, setAssets] = React.useState<Asset[]>(initialAssets);
  const [references, setReferences] = React.useState<Asset[]>([]);
  const [firstFrame, setFirstFrame] = React.useState<Asset | null>(null);
  const [lastFrame, setLastFrame] = React.useState<Asset | null>(null);
  const [picker, setPicker] = React.useState<PickerTarget | null>(null);

  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [lightboxAsset, setLightboxAsset] = React.useState<Asset | null>(null);

  const [projectId, setProjectId] = React.useState<string | null>(initialProject?.id ?? null);
  const [projectTitle, setProjectTitle] = React.useState<string | null>(initialProject?.title ?? null);
  const [saveState, setSaveState] = React.useState<SaveState>("idle");

  const [results, setResults] = React.useState<Asset[]>(initialProject?.assets.filter((a) => a.source === "generation") ?? []);
  const [selectedResult, setSelectedResult] = React.useState<Asset | null>(
    initialProject?.assets.find((asset) => asset.source === "generation") ?? null,
  );
  const [job, setJob] = React.useState<GenerationJob | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<{ message: string; code?: string } | null>(null);

  const cancelToken = React.useRef<{ cancelled: boolean }>({ cancelled: false });
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const kind: "image" | "video" = mode === "image" ? "image" : "video";
  const models = catalog.models.filter((model) => model.kind === kind);
  const selectedModel = catalog.models.find((model) => model.id === modelId) ?? models[0];
  const availableModels = catalog.models.filter((model) => model.available);
  const setupNeeded = availableModels.length === 0;
  const modelReady = Boolean(selectedModel?.available);

  const duration = selectedModel?.durations[0] ?? 10;
  const estimate = selectedModel
    ? selectedModel.creditUnit === "second"
      ? selectedModel.creditCost * duration
      : selectedModel.creditCost * outputCount
    : 0;
  const availableCredits = user.credits - user.reservedCredits;
  const notEnoughCredits = estimate > availableCredits;

  React.useEffect(() => {
    const model = catalog.models.find((item) => item.id === modelId);
    if (!model) return;
    setAspectRatio((current) => (model.aspectRatios.includes(current) ? current : model.aspectRatios[0]));
    setResolution((current) => (model.resolutions.includes(current) ? current : model.resolutions[0]));
    setOutputCount((current) => Math.min(current, model.maxOutputs));
  }, [modelId, catalog.models]);

  React.useEffect(() => {
    return () => {
      cancelToken.current.cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!projectId) return;
    setSaveState("saving");
    const timeout = setTimeout(async () => {
      try {
        await api(`/api/projects/${projectId}`, {
          method: "PATCH",
          body: JSON.stringify({
            model: selectedModel?.id ?? null,
            provider: selectedModel?.provider ?? null,
            aspectRatio,
            settings: {
              resolution,
              durationSeconds: kind === "video" ? duration : undefined,
              generateAudio: selectedModel?.supportsAudio ? generateAudio : false,
              stylePreset: stylePreset || undefined,
              seed: seed.trim() ? Number(seed) : null,
              negativePrompt: selectedModel?.supportsNegativePrompt ? negativePrompt : "",
            },
          }),
        });
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 900);
    return () => clearTimeout(timeout);
    // The model catalog is stable for a session; these are the user-editable settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, modelId, aspectRatio, resolution, outputCount, stylePreset, seed, negativePrompt, generateAudio, kind]);

  function switchMode(next: ProjectMode) {
    if (next === mode) return;
    cancelToken.current.cancelled = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setGenerating(false);
    setMode(next);
    setError(null);
    setJob(null);
    setResults([]);
    setSelectedResult(null);
    if (projectId) {
      setProjectId(null);
      setProjectTitle(null);
      setSaveState("idle");
      window.history.replaceState(null, "", next === "storyboard" ? "/create?mode=storyboard" : `/create?mode=${next}`);
    }
    if (next !== "storyboard") {
      const nextKind = next === "image" ? "image" : "video";
      const nextModel = modelForKind(catalog, nextKind);
      if (nextModel) setModelId(nextModel.id);
      setAspectRatio(nextKind === "image" ? "1:1" : "16:9");
    }
  }

  function finishGeneration(generated: Asset[]) {
    setResults(generated);
    setSelectedResult(generated[0] ?? null);
    if (generated.length === 0) {
      setError({ message: "The provider returned no assets. Try again with a shorter prompt." });
    } else {
      toast.success(
        generated.length > 1 ? `${generated.length} frames ready.` : `${kind === "video" ? "Clip" : "Frame"} ready.`,
      );
    }
    void refresh();
    setSaveState("saved");
  }

  async function pollJob(jobId: string, token: { cancelled: boolean }) {
    for (let attempt = 0; attempt < 220; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt < 2 ? 1600 : 3200));
      if (token.cancelled) return;
      const data = await api<GenerateResponse>(`/api/jobs/${jobId}`);
      if (token.cancelled) return;
      setJob(data.job);
      if (data.job.status === "succeeded") {
        finishGeneration(data.assets);
        return;
      }
      if (data.job.status === "failed" || data.job.status === "cancelled") {
        setError({
          message: data.job.error ?? "The generation did not complete. Reserved credits were released.",
          code: data.job.status,
        });
        return;
      }
    }
    setError({
      message:
        "This is taking longer than expected. The job may still finish — check Usage for its latest status.",
    });
  }

  async function generate() {
    if (!prompt.trim() || prompt.trim().length < 3) {
      toast.error("Describe what you want to create.");
      return;
    }
    if (!selectedModel) {
      toast.error("Choose a model first.");
      return;
    }
    if (!selectedModel.available) {
      setSetupOpen(true);
      return;
    }
    if (notEnoughCredits) {
      toast.error("Not enough credits available for this generation.");
      return;
    }

    const token = { cancelled: false };
    cancelToken.current = token;
    setGenerating(true);
    setError(null);
    setJob(null);
    setResults([]);
    setSelectedResult(null);
    setElapsed(0);
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    try {
      let activeProjectId = projectId;
      if (!activeProjectId) {
        const created = await api<{ project: ProjectDetail }>("/api/projects", {
          method: "POST",
          body: JSON.stringify({
            title: projectTitleFromPrompt(prompt),
            description: "Created from the studio composer.",
            mode: kind === "image" ? "image" : "video",
            aspectRatio,
            prompt,
            model: selectedModel.id,
            provider: selectedModel.provider,
            templateSlug: template?.slug ?? null,
            settings: {
              resolution,
              durationSeconds: kind === "video" ? duration : undefined,
              stylePreset: stylePreset || undefined,
            },
          }),
        });
        activeProjectId = created.project.id;
        setProjectId(activeProjectId);
        setProjectTitle(created.project.title);
        window.history.replaceState(null, "", `/create?project=${activeProjectId}&mode=${mode}`);
      }

      const response = await api<GenerateResponse>("/api/generate", {
        method: "POST",
        body: JSON.stringify({
          kind,
          model: selectedModel.id,
          prompt: prompt.trim(),
          negativePrompt: selectedModel.supportsNegativePrompt ? negativePrompt.trim() : "",
          aspectRatio,
          resolution: resolution || selectedModel.resolutions[0],
          durationSeconds: kind === "video" ? duration : undefined,
          outputCount: kind === "image" ? outputCount : 1,
          stylePreset: stylePreset || undefined,
          seed: seed.trim() ? Number(seed) : undefined,
          generateAudio: selectedModel.supportsAudio ? generateAudio : false,
          projectId: activeProjectId,
          referenceAssetIds: references.map((asset) => asset.id),
          firstFrameAssetId: selectedModel.supportsFirstFrame ? firstFrame?.id ?? null : null,
          lastFrameAssetId: selectedModel.supportsLastFrame ? lastFrame?.id ?? null : null,
          idempotencyKey: newIdempotencyKey(),
        }),
      });

      if (token.cancelled) return;
      setJob(response.job);
      if (response.job.status === "succeeded") {
        finishGeneration(response.assets);
      } else if (response.job.status === "failed" || response.job.status === "cancelled") {
        setError({
          message: response.job.error ?? "The generation did not complete.",
          code: response.job.status,
        });
      } else {
        await pollJob(response.job.id, token);
      }
    } catch (caught) {
      if (token.cancelled) return;
      const apiError = caught instanceof ApiError ? caught : null;
      setError({
        message: errorMessage(caught),
        code: apiError?.code,
      });
      if (apiError?.code === "provider_not_configured") setSetupOpen(true);
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (!token.cancelled) setGenerating(false);
    }
  }

  async function cancelGeneration() {
    cancelToken.current.cancelled = true;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (job) {
      try {
        const result = await api<{ job: GenerationJob }>(`/api/jobs/${job.id}/cancel`, {
          method: "POST",
        });
        setJob(result.job);
        toast.success("Generation cancelled. Reserved credits were released.");
      } catch (caught) {
        toast.error(errorMessage(caught));
      }
    }
    setGenerating(false);
  }

  function reset() {
    cancelToken.current.cancelled = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setGenerating(false);
    setPrompt("");
    setResults([]);
    setSelectedResult(null);
    setJob(null);
    setError(null);
    setReferences([]);
    setFirstFrame(null);
    setLastFrame(null);
    setProjectId(null);
    setProjectTitle(null);
    setSaveState("idle");
    window.history.replaceState(null, "", `/create?mode=${mode}`);
  }

  async function toggleFavorite(asset: Asset) {
    try {
      const result = await api<{ asset: Asset }>(`/api/assets/${asset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ favorite: !asset.favorite }),
      });
      setResults((current) => current.map((item) => (item.id === asset.id ? result.asset : item)));
      setSelectedResult((current) => (current?.id === asset.id ? result.asset : current));
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  function applyReference(asset: Asset) {
    if (asset.kind !== "image") {
      toast.error("References must be still images.");
      return;
    }
    if (!selectedModel?.supportsReferences) {
      toast.error("This model does not accept reference images.");
      return;
    }
    setReferences((current) => {
      if (current.some((item) => item.id === asset.id)) return current;
      if (current.length >= 8) {
        toast.error("You can use up to 8 references.");
        return current;
      }
      return [...current, asset];
    });
    toast.success("Added to references.");
  }

  if (mode === "storyboard") {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Create</p>
            <h2 className="mt-1.5 text-[28px] font-semibold tracking-[-0.045em]">Build a storyboard</h2>
          </div>
          <Tabs value={mode} onValueChange={(value) => switchMode(value as ProjectMode)}>
            <TabsList>
              <TabsTrigger value="video">
                <Clapperboard /> Videos
              </TabsTrigger>
              <TabsTrigger value="image">
                <ImagePlus /> Images
              </TabsTrigger>
              <TabsTrigger value="storyboard">
                <Layers /> Storyboard
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <StoryboardStart initialPrompt={initialPrompt} template={template} />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col lg:h-[calc(100dvh-4.5rem)] lg:min-h-0 lg:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Tabs value={mode} onValueChange={(value) => switchMode(value as ProjectMode)}>
            <TabsList>
              <TabsTrigger value="video">
                <Clapperboard /> Videos
              </TabsTrigger>
              <TabsTrigger value="image">
                <ImagePlus /> Images
              </TabsTrigger>
              <TabsTrigger value="storyboard">
                <Layers /> Storyboard
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <span className="hidden max-w-[260px] truncate text-[11px] font-medium text-muted-foreground sm:block">
            {projectTitle ?? "New creation"}
          </span>
          <AutosaveIndicator state={saveState} />
        </div>
        <div className="flex items-center gap-1.5">
          {projectId ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/projects/${projectId}`}>
                Open project <ArrowRight />
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={reset}>
            <Plus /> New
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_300px]">
        <aside className="border-b border-border/60 bg-card/20 lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="lg:h-full lg:overflow-y-auto">
            <div className="space-y-5 p-4 sm:p-5">
              {setupNeeded ? (
                <button
                  onClick={() => setSetupOpen(true)}
                  className="flex w-full items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-left"
                >
                  <Info className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                      Setup mode — generation is off
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-relaxed text-amber-700/80 dark:text-amber-200/70">
                      Add a server provider key to generate. Storyboards and uploads still work.
                    </span>
                  </span>
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
                </button>
              ) : null}

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="prompt" className="text-[11px]">
                    {kind === "video" ? "Describe the shot" : "Describe the image"}
                  </Label>
                  <button
                    onClick={() => setAssistantOpen(true)}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <Wand2 className="size-3" /> Assist
                  </button>
                </div>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      void generate();
                    }
                  }}
                  rows={5}
                  maxLength={4000}
                  placeholder={
                    kind === "video"
                      ? "A slow dolly through a rain-soaked neon alley, anamorphic flares, distant thunder…"
                      : "An editorial portrait in warm concrete light, single softbox, medium format…"
                  }
                  className="mt-2 min-h-[120px] resize-none text-[12px] leading-relaxed"
                />
                <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted-foreground">
                  <span>{prompt.length}/4000</span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border bg-muted px-1">⌘</kbd>
                    <kbd className="rounded border border-border bg-muted px-1">↵</kbd>
                    to generate
                  </span>
                </div>
                {prompt.length === 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {QUICK_IDEAS.slice(0, 2).map((idea) => (
                      <button
                        key={idea}
                        onClick={() => setPrompt(idea)}
                        className="max-w-full truncate rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[9px] text-muted-foreground hover:text-foreground"
                      >
                        {idea}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Model
                  </p>
                  <Badge variant={modelReady ? "success" : "warning"} className="text-[8px]">
                    {modelReady ? "Connected" : "Setup needed"}
                  </Badge>
                </div>
                <Select
                  value={selectedModel?.id ?? ""}
                  onChange={(event) => setModelId(event.target.value)}
                  aria-label="Model"
                  className="h-10 text-[11px]"
                >
                  {models.length === 0 ? <option value="">No models available</option> : null}
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label} · {model.providerLabel}
                      {model.available ? "" : " (setup needed)"}
                    </option>
                  ))}
                </Select>
                {selectedModel ? (
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    {selectedModel.description}
                  </p>
                ) : null}

                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium text-muted-foreground">Aspect ratio</p>
                    <span className="text-[9px] text-muted-foreground">{aspectRatio}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-5 gap-1">
                    {(selectedModel?.aspectRatios ?? ["16:9", "9:16", "1:1", "4:3", "3:4"]).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={cn(
                          "flex h-8 items-center justify-center rounded-lg border text-[9px] font-medium transition-colors",
                          aspectRatio === ratio
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border/70 bg-card text-muted-foreground hover:text-foreground",
                        )}
                        aria-pressed={aspectRatio === ratio}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium text-muted-foreground">Resolution</p>
                    <Select
                      value={resolution || selectedModel?.resolutions[0] || ""}
                      onChange={(event) => setResolution(event.target.value)}
                      aria-label="Resolution"
                    >
                      {(selectedModel?.resolutions ?? ["Auto"]).map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium text-muted-foreground">Style</p>
                    <Select
                      value={stylePreset}
                      onChange={(event) => setStylePreset(event.target.value)}
                      aria-label="Style preset"
                    >
                      <option value="">None</option>
                      {STYLE_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {kind === "video" ? (
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-2.5 py-2">
                    <div>
                      <p className="text-[10px] font-medium">Duration</p>
                      <p className="text-[9px] text-muted-foreground">Provider-fixed</p>
                    </div>
                    <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-semibold">{duration}s</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-2.5 py-2">
                    <div>
                      <p className="text-[10px] font-medium">Outputs</p>
                      <p className="text-[9px] text-muted-foreground">Up to {selectedModel?.maxOutputs ?? 1} frames</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="size-7"
                        onClick={() => setOutputCount((count) => Math.max(1, count - 1))}
                        disabled={outputCount <= 1}
                        aria-label="Fewer outputs"
                      >
                        <Minus />
                      </Button>
                      <span className="w-5 text-center text-[11px] font-semibold">{outputCount}</span>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="size-7"
                        onClick={() =>
                          setOutputCount((count) => Math.min(selectedModel?.maxOutputs ?? 1, count + 1))
                        }
                        disabled={outputCount >= (selectedModel?.maxOutputs ?? 1)}
                        aria-label="More outputs"
                      >
                        <Plus />
                      </Button>
                    </div>
                  </div>
                )}

                {selectedModel?.supportsAudio ? (
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-2.5 py-2">
                    <div>
                      <p className="text-[10px] font-medium">Native audio</p>
                      <p className="text-[9px] text-muted-foreground">Ambience and sound design</p>
                    </div>
                    <Switch
                      checked={generateAudio}
                      onCheckedChange={setGenerateAudio}
                      aria-label="Generate native audio"
                    />
                  </div>
                ) : null}

                <button
                  onClick={() => setAdvancedOpen((open) => !open)}
                  className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                  aria-expanded={advancedOpen}
                >
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="size-3" /> Advanced
                  </span>
                  <ChevronDown className={cn("size-3 transition-transform", advancedOpen && "rotate-180")} />
                </button>
                {advancedOpen ? (
                  <div className="space-y-2.5 rounded-xl border border-border/70 bg-card/60 p-2.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="seed" className="text-[10px]">
                        Seed <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        id="seed"
                        inputMode="numeric"
                        value={seed}
                        onChange={(event) => setSeed(event.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="Random"
                        className="h-8 text-[11px]"
                      />
                    </div>
                    {selectedModel?.supportsNegativePrompt ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="negative" className="text-[10px]">
                          Negative prompt
                        </Label>
                        <Textarea
                          id="negative"
                          value={negativePrompt}
                          onChange={(event) => setNegativePrompt(event.target.value)}
                          rows={2}
                          maxLength={1000}
                          placeholder="What to avoid…"
                          className="min-h-[56px] text-[11px]"
                        />
                      </div>
                    ) : (
                      <p className="flex items-start gap-1.5 text-[9px] leading-relaxed text-muted-foreground">
                        <Lock className="mt-0.5 size-2.5 shrink-0" />
                        {selectedModel?.label ?? "This model"} does not expose a negative prompt. The control
                        is hidden rather than silently ignored.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    References
                  </p>
                  <span className="text-[9px] text-muted-foreground">
                    {references.length + (firstFrame ? 1 : 0) + (lastFrame ? 1 : 0)} selected
                  </span>
                </div>
                {selectedModel?.supportsFirstFrame || selectedModel?.supportsLastFrame ? (
                  <div className="grid grid-cols-2 gap-2">
                    <ReferenceSlot
                      label="First frame"
                      asset={firstFrame}
                      onPick={() => setPicker("first")}
                      onClear={() => setFirstFrame(null)}
                    />
                    <ReferenceSlot
                      label="Last frame"
                      asset={lastFrame}
                      onPick={() => setPicker("last")}
                      onClear={() => setLastFrame(null)}
                    />
                  </div>
                ) : null}
                <div className="grid grid-cols-4 gap-1.5">
                  {references.map((asset) => (
                    <div key={asset.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border/70 bg-muted">
                      <AssetPreview asset={asset} />
                      <button
                        onClick={() => setReferences((current) => current.filter((item) => item.id !== asset.id))}
                        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                        aria-label={`Remove ${asset.title}`}
                      >
                        <X className="size-2.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setPicker("references")}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-card/40 text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                    aria-label="Add reference image"
                  >
                    <ImagePlus className="size-3.5" />
                    <span className="text-[8px] font-medium">Add</span>
                  </button>
                </div>
                <p className="text-[9px] leading-relaxed text-muted-foreground">
                  {selectedModel?.supportsReferences
                    ? "References guide identity, composition and style. Up to 8 images."
                    : "This model does not accept references. Uploads remain available in your library."}
                </p>
              </div>

              <div className="sticky bottom-14 -mx-4 -mb-4 border-t border-border/70 bg-card/95 p-4 backdrop-blur sm:-mx-5 sm:-mb-5 sm:p-5 lg:bottom-0">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Estimated cost</span>
                  <span className="flex items-center gap-1 font-semibold">
                    <Coins className="size-3 text-primary" />
                    {formatCredits(estimate)} credits
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
                  <span>{formatCredits(availableCredits)} available</span>
                  {notEnoughCredits ? (
                    <Link href="/usage" className="font-medium text-destructive hover:underline">
                      Not enough credits
                    </Link>
                  ) : (
                    <span>Reserved then captured</span>
                  )}
                </div>
                <Button
                  className="mt-2.5 w-full"
                  size="lg"
                  onClick={generate}
                  loading={generating}
                  disabled={!modelReady || notEnoughCredits || prompt.trim().length < 3}
                >
                  {!generating ? <Sparkles /> : null}
                  {generating
                    ? "Generating…"
                    : `Generate ${kind === "video" ? "video" : "image"}`}
                </Button>
                <p className="mt-1.5 text-center text-[9px] text-muted-foreground">
                  {setupNeeded
                    ? "Add a provider key to enable generation."
                    : "Prompts are sent only to the selected provider."}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-h-[520px] min-w-0 flex-col lg:min-h-0 lg:overflow-y-auto">
          <div className="flex-1 p-3 sm:p-5">
            {error ? (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.06] p-3">
                <Info className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-destructive">
                    {error.code === "provider_not_configured" ? "Provider setup needed" : "Generation issue"}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-destructive/80">{error.message}</p>
                  {error.code === "provider_not_configured" ? (
                    <button onClick={() => setSetupOpen(true)} className="mt-1.5 text-[10px] font-semibold text-primary hover:underline">
                      View setup steps
                    </button>
                  ) : null}
                </div>
                <button onClick={() => setError(null)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss error">
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}

            {generating ? (
              <div
                className="relative mx-auto flex w-full max-w-[920px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-[#0b0b11]"
                style={{ ...stageStyle(aspectRatio), minHeight: 320 }}
              >
                <div className="absolute inset-0 grid-fade opacity-30" />
                <div className="absolute inset-0 bg-[radial-gradient(600px_300px_at_50%_30%,rgba(138,180,248,0.16),transparent_70%)]" />
                <div className="relative flex flex-col items-center px-6 text-center">
                  <span className="relative flex size-16 items-center justify-center">
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
                    <span className="absolute inset-2 rounded-full border border-primary/30" />
                    <Loader2 className="size-6 animate-spin text-[#a8c7fa]" />
                  </span>
                  <p className="mt-5 text-sm font-semibold text-white">
                    {job?.status === "queued" ? "Queued at the provider" : `Rendering your ${kind}`}
                  </p>
                  <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-white/55">
                    {truncate(prompt, 120)}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-[10px] text-white/50">
                    <span>{selectedModel?.label}</span>
                    <span>·</span>
                    <span>{elapsed}s elapsed</span>
                    {job?.creditsReserved ? (
                      <>
                        <span>·</span>
                        <span>{job.creditsReserved} credits reserved</span>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-5 h-1 w-48 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-1/2 animate-[shimmer_1.6s_linear_infinite] rounded-full bg-gradient-to-r from-transparent via-[#a8c7fa] to-transparent" />
                  </div>
                  <p className="mt-3 text-[9px] text-white/35">
                    {kind === "video"
                      ? "Video can take a few minutes. You can leave this page — the job keeps running."
                      : "Image generation usually takes 10–40 seconds."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-5 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                    onClick={cancelGeneration}
                  >
                    <X /> Cancel generation
                  </Button>
                </div>
              </div>
            ) : selectedResult ? (
              <div className="mx-auto w-full max-w-[920px]">
                <div
                  className="relative overflow-hidden rounded-2xl border border-border/70 bg-[#0b0b11]"
                  style={stageStyle(selectedResult.aspectRatio ?? aspectRatio)}
                >
                  <AssetPreview asset={selectedResult} videoControls className="object-contain" priority />
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/45 to-transparent p-3">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="bg-black/40 text-[8px] text-white backdrop-blur">
                        {selectedResult.kind === "video" ? <Film className="size-2.5" /> : <ImageIcon className="size-2.5" />}
                        {selectedResult.kind}
                      </Badge>
                      <Badge variant="secondary" className="bg-black/40 text-[8px] text-white backdrop-blur">
                        {selectedResult.aspectRatio}
                      </Badge>
                    </div>
                    <Badge variant="secondary" className="bg-black/40 text-[8px] text-white backdrop-blur">
                      {selectedResult.model ?? selectedModel?.label}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{selectedResult.title}</p>
                    <p className="mt-1 line-clamp-2 max-w-2xl text-[10px] leading-relaxed text-muted-foreground">
                      {selectedResult.prompt}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => void toggleFavorite(selectedResult)}
                          aria-label="Favorite result"
                        >
                          <Check className={selectedResult.favorite ? "text-emerald-500" : ""} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Favorite</TooltipContent>
                    </Tooltip>
                    {selectedResult.url ? (
                      <Button asChild variant="outline" size="icon-sm">
                        <a href={selectedResult.url} download target="_blank" rel="noreferrer" aria-label="Download result">
                          <Download />
                        </a>
                      </Button>
                    ) : null}
                    <Button variant="outline" size="icon-sm" onClick={() => setLightboxAsset(selectedResult)} aria-label="Expand result">
                      <Expand />
                    </Button>
                    {selectedModel?.supportsReferences ? (
                      <Button variant="outline" size="sm" onClick={() => applyReference(selectedResult)}>
                        <ImagePlus /> Reference
                      </Button>
                    ) : null}
                    {projectId ? (
                      <Button asChild size="sm">
                        <Link href={`/projects/${projectId}`}>
                          Open project <ArrowRight />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="relative mx-auto flex w-full max-w-[920px] flex-col items-center justify-center overflow-hidden rounded-[1.75rem] border border-border/60 bg-card/20 px-6 text-center"
                style={{ ...stageStyle(aspectRatio), minHeight: 320 }}
              >
                <div className="absolute inset-0 grid-fade opacity-25" />
                <div className="relative">
                  <span className="mx-auto flex size-14 items-center justify-center rounded-full border border-border/70 bg-card/70 text-muted-foreground premium-shadow">
                    {kind === "video" ? <MonitorPlay className="size-6" /> : <Aperture className="size-6" />}
                  </span>
                  <h2 className="mt-4 text-[15px] font-semibold tracking-[-0.02em]">Type a prompt to start</h2>
                  <p className="mx-auto mt-1.5 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
                    Choose a model and settings, then generate. Results are saved to your media
                    library automatically.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                    <Badge variant="outline" className="text-[9px]">
                      <Sparkles className="size-2.5 text-primary" /> {aspectRatio}
                    </Badge>
                    <Badge variant="outline" className="text-[9px]">
                      {resolution || selectedModel?.resolutions[0] || "Auto"}
                    </Badge>
                    <Badge variant="outline" className="text-[9px]">
                      {selectedModel?.label ?? "Choose a model"}
                    </Badge>
                  </div>
                  {template ? (
                    <p className="mt-4 text-[10px] text-muted-foreground">
                      Starting from <span className="font-medium text-foreground">{template.title}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            {results.length > 0 ? (
              <div className="mx-auto mt-4 w-full max-w-[920px]">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Results · {results.length}
                  </p>
                  <button
                    onClick={() => {
                      setResults([]);
                      setSelectedResult(null);
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {results.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => setSelectedResult(asset)}
                      className={cn(
                        "relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg border bg-muted transition-all",
                        selectedResult?.id === asset.id
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border/70 hover:border-primary/30",
                      )}
                      aria-label={`View ${asset.title}`}
                      aria-pressed={selectedResult?.id === asset.id}
                    >
                      <AssetPreview asset={asset} />
                      {asset.kind === "video" ? (
                        <span className="absolute bottom-1 right-1 flex size-4 items-center justify-center rounded-full bg-black/50 text-white">
                          <Film className="size-2" />
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {job ? (
            <div className="border-t border-border/70 bg-card/30 px-4 py-2.5">
              <div className="mx-auto flex max-w-[920px] flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      job.status === "succeeded"
                        ? "bg-emerald-500"
                        : job.status === "failed"
                          ? "bg-destructive"
                          : "animate-pulse bg-primary",
                    )}
                  />
                  Job {job.status}
                </span>
                <span>{job.model}</span>
                <span>{job.creditsReserved} credits</span>
                <span>{job.outputCount} output{job.outputCount === 1 ? "" : "s"}</span>
                <span className="ml-auto font-mono text-[8px] text-muted-foreground/60">{job.id.slice(0, 8)}</span>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="hidden border-l border-border/70 bg-card/30 xl:flex xl:min-h-0 xl:w-[300px] xl:flex-col">
          <div className="flex h-11 items-center justify-between border-b border-border/70 px-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Inspector
            </p>
            {selectedResult ? <Badge variant="outline" className="text-[8px] capitalize">{selectedResult.kind}</Badge> : null}
          </div>
          {selectedResult ? (
            <ResultInspector
              asset={selectedResult}
              onFavorite={() => void toggleFavorite(selectedResult)}
              onExpand={() => setLightboxAsset(selectedResult)}
              onUseReference={selectedModel?.supportsReferences ? () => applyReference(selectedResult) : undefined}
            />
          ) : (
            <InspectorEmpty />
          )}
        </aside>
      </div>

      <PromptAssistantDialog
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        prompt={prompt}
        mode={kind}
        onApply={(text) => setPrompt(text)}
      />

      <ReferencePickerDialog
        open={picker !== null}
        onOpenChange={(open) => {
          if (!open) setPicker(null);
        }}
        assets={assets}
        onUploaded={(uploaded) => setAssets((current) => [...uploaded, ...current])}
        multiple={picker === "references"}
        max={8}
        title={picker === "first" ? "Choose the first frame" : picker === "last" ? "Choose the last frame" : "Choose references"}
        description={
          picker === "first" || picker === "last"
            ? "The clip will start or end on this frame."
            : "Guide identity, composition and style with up to 8 images."
        }
        onConfirm={(chosen) => {
          if (chosen.length === 0) return;
          if (picker === "first") setFirstFrame(chosen[0]);
          else if (picker === "last") setLastFrame(chosen[0]);
          else {
            setReferences((current) => {
              const merged = [...current];
              for (const asset of chosen) {
                if (!merged.some((item) => item.id === asset.id) && merged.length < 8) merged.push(asset);
              }
              return merged;
            });
          }
        }}
      />

      <AssetLightbox
        asset={lightboxAsset}
        open={lightboxAsset !== null}
        onOpenChange={(open) => {
          if (!open) setLightboxAsset(null);
        }}
        onUseReference={selectedModel?.supportsReferences ? (asset) => applyReference(asset) : undefined}
      />

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="size-4 text-primary" /> Connect a generation model
            </DialogTitle>
            <DialogDescription>
              Whisk Flow stays fully browsable without provider keys. Generation turns on when a
              server environment variable is present.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {catalog.setups.map((setup) => (
              <div key={setup.provider} className="rounded-xl border border-border/70 bg-card/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">{setup.label}</p>
                  <Badge variant={setup.configured ? "success" : "outline"} className="text-[8px]">
                    {setup.configured ? "Connected" : "Not connected"}
                  </Badge>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{setup.note}</p>
                <code className="mt-2 inline-block rounded-md bg-muted px-2 py-1 text-[10px]">
                  {setup.envVariables.join(" · ")}
                </code>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-[10px] leading-relaxed text-muted-foreground">
            Add the key to <code className="font-semibold">.env.local</code> on the server, restart the
            app, then refresh this page. Never put provider keys in the browser.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSetupOpen(false)}>
              Close
            </Button>
            <Button asChild>
              <Link href="/settings#providers">
                Open settings <ArrowRight />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReferenceSlot({
  label,
  asset,
  onPick,
  onClear,
}: {
  label: string;
  asset: Asset | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[9px] font-medium text-muted-foreground">{label}</p>
      {asset ? (
        <div className="group relative aspect-video overflow-hidden rounded-lg border border-border/70 bg-muted">
          <AssetPreview asset={asset} />
          <button
            onClick={onClear}
            className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
            aria-label={`Clear ${label}`}
          >
            <X className="size-2.5" />
          </button>
          <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-2 text-[8px] text-white">
            {asset.title}
          </span>
        </div>
      ) : (
        <button
          onClick={onPick}
          className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-card/40 text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
        >
          <Upload className="size-3" />
          <span className="text-[8px] font-medium">Choose</span>
        </button>
      )}
    </div>
  );
}

function ResultInspector({
  asset,
  onFavorite,
  onExpand,
  onUseReference,
}: {
  asset: Asset;
  onFavorite: () => void;
  onExpand: () => void;
  onUseReference?: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copyPrompt() {
    if (!asset.prompt) return;
    try {
      await navigator.clipboard.writeText(asset.prompt);
      setCopied(true);
      toast.success("Prompt copied.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not access the clipboard.");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-border/70 bg-muted">
          <AssetPreview asset={asset} />
          <button
            onClick={onExpand}
            className="absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-lg bg-black/45 text-white backdrop-blur hover:bg-black/65"
            aria-label="Expand"
          >
            <Expand className="size-3.5" />
          </button>
        </div>
        <p className="mt-3 truncate text-xs font-semibold">{asset.title}</p>
        <p className="mt-0.5 text-[9px] text-muted-foreground">
          {asset.kind} · {asset.aspectRatio} · {asset.model ?? "Uploaded"}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" onClick={onFavorite}>
            <Check /> Favorite
          </Button>
          {asset.url ? (
            <Button asChild variant="outline" size="sm">
              <a href={asset.url} download target="_blank" rel="noreferrer">
                <Download /> Save
              </a>
            </Button>
          ) : null}
        </div>
        {onUseReference ? (
          <Button variant="outline" size="sm" className="mt-1.5 w-full" onClick={onUseReference}>
            <ImagePlus /> Use as reference
          </Button>
        ) : null}
      </div>

      <Separator />

      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Prompt
          </p>
          <button onClick={copyPrompt} className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground">
            {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-card p-2.5 text-[10px] leading-relaxed text-foreground/80">
          {asset.prompt || "No prompt recorded."}
        </p>
        {asset.negativePrompt ? (
          <>
            <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Negative
            </p>
            <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-border/70 bg-card p-2.5 text-[10px] leading-relaxed text-foreground/80">
              {asset.negativePrompt}
            </p>
          </>
        ) : null}
      </div>

      <Separator />

      <div className="space-y-2 p-4 text-[10px]">
        {[
          ["Provider", asset.provider ?? "—"],
          ["Model", asset.model ?? "—"],
          ["Resolution", asset.width && asset.height ? `${asset.width} × ${asset.height}` : "—"],
          ["Folder", asset.folder],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{label}</span>
            <span className="max-w-[150px] truncate font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
