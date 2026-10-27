"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, Clapperboard, Copy, Download, Film, GripVertical, Heart, ImageIcon, ImagePlus, Info, Layers, Loader2, Maximize2, MoreHorizontal, Pause, Play, Plus, RefreshCw, Settings2, Sparkles, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSession } from "@/components/session-provider";
import { AutosaveIndicator, type SaveState } from "@/components/studio/autosave-indicator";
import { InspectorEmpty } from "@/components/studio/inspector-empty";
import { SceneStatusBadge } from "@/components/studio/status-badge";
import { AssetPreview } from "@/components/media/asset-preview";
import { AssetLightbox } from "@/components/media/asset-lightbox";
import { ReferencePickerDialog } from "@/components/create/reference-picker-dialog";
import { api, errorMessage } from "@/lib/client-api";
import {
  cn,
  formatDate,
  formatDuration,
  newIdempotencyKey,
  slugify,
  truncate,
} from "@/lib/utils";
import type {
  Asset,
  GenerationJob,
  ProjectDetail,
  ProviderCatalog,
  PublicModel,
  Scene,
} from "@/lib/types";

interface GenerateResponse {
  job: GenerationJob;
  assets: Asset[];
}

function modelForProject(catalog: ProviderCatalog, kind: "image" | "video", preferred?: string | null) {
  const models = catalog.models.filter((model) => model.kind === kind);
  return (
    models.find((model) => model.id === preferred) ??
    models.find((model) => model.available) ??
    models[0]
  );
}

export function ProjectWorkspace({
  initialProject,
  catalog,
  mediaAssets,
}: {
  initialProject: ProjectDetail;
  catalog: ProviderCatalog;
  mediaAssets: Asset[];
}) {
  const router = useRouter();
  const { user, refresh } = useSession();
  const kind: "image" | "video" = initialProject.mode === "image" ? "image" : "video";
  const initialModel = modelForProject(catalog, kind, initialProject.model);

  const [project, setProject] = React.useState(initialProject);
  const [scenes, setScenes] = React.useState(initialProject.scenes);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialProject.scenes[0]?.id ?? null);
  const [titleDraft, setTitleDraft] = React.useState(initialProject.title);
  const [modelId, setModelId] = React.useState(initialModel?.id ?? "");
  const [resolution, setResolution] = React.useState(
    initialProject.settings.resolution ?? initialModel?.resolutions[0] ?? "",
  );
  const [generateAudio, setGenerateAudio] = React.useState(Boolean(initialProject.settings.generateAudio));
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [generatingSceneId, setGeneratingSceneId] = React.useState<string | null>(null);
  const [lightboxAsset, setLightboxAsset] = React.useState<Asset | null>(null);
  const [addSceneOpen, setAddSceneOpen] = React.useState(false);
  const [newScene, setNewScene] = React.useState({ title: "", prompt: "", duration: "10" });
  const [adding, setAdding] = React.useState(false);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [replaceScene, setReplaceScene] = React.useState<Scene | null>(null);
  const [deletingScene, setDeletingScene] = React.useState<Scene | null>(null);
  const [deleteProjectOpen, setDeleteProjectOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [assets, setAssets] = React.useState<Asset[]>(mediaAssets);
  const [pickerAssets, setPickerAssets] = React.useState<Asset[]>(mediaAssets);
  const inspectorRef = React.useRef<HTMLElement | null>(null);

  const models = catalog.models.filter((model) => model.kind === kind);
  const selectedModel = models.find((model) => model.id === modelId) ?? models[0];
  const selectedScene = scenes.find((scene) => scene.id === selectedId) ?? null;
  const availableModels = catalog.models.filter((model) => model.available);
  const setupNeeded = availableModels.length === 0;
  const estimate = selectedModel
    ? selectedModel.creditUnit === "second"
      ? selectedModel.creditCost * (selectedModel.durations[0] ?? 10)
      : selectedModel.creditCost
    : 0;

  React.useEffect(() => {
    setTitleDraft(project.title);
  }, [project.title]);

  React.useEffect(() => {
    const model = models.find((item) => item.id === modelId);
    if (!model) return;
    setResolution((current) => (model.resolutions.includes(current) ? current : model.resolutions[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  React.useEffect(() => {
    if (scenes.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !scenes.some((scene) => scene.id === selectedId)) {
      setSelectedId(scenes[0].id);
    }
  }, [scenes, selectedId]);

  const projectSettingsTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (projectSettingsTimeout.current) clearTimeout(projectSettingsTimeout.current);
    projectSettingsTimeout.current = setTimeout(async () => {
      try {
        await api(`/api/projects/${project.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            model: selectedModel?.id ?? null,
            provider: selectedModel?.provider ?? null,
            settings: { resolution, generateAudio },
          }),
        });
      } catch {
        // The visible save indicator is reserved for scene and title edits.
      }
    }, 1000);
    return () => {
      if (projectSettingsTimeout.current) clearTimeout(projectSettingsTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId, resolution, generateAudio, project.id]);

  async function reload(select?: string | null) {
    const data = await api<{ project: ProjectDetail }>(`/api/projects/${project.id}`);
    setProject(data.project);
    setScenes(data.project.scenes);
    if (select !== undefined) setSelectedId(select);
    const nextAssets = new Map(assets.map((asset) => [asset.id, asset]));
    for (const asset of data.project.assets) nextAssets.set(asset.id, asset);
    setAssets([...nextAssets.values()]);
    setPickerAssets([...nextAssets.values()]);
  }

  function selectScene(sceneId: string) {
    setSelectedId(sceneId);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => {
        inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  async function saveTitle() {
    const title = titleDraft.trim();
    if (!title || title === project.title) {
      setTitleDraft(project.title);
      return;
    }
    setSaveState("saving");
    try {
      const result = await api<{ project: ProjectDetail }>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      setProject((current) => ({ ...current, title: result.project.title }));
      setTitleDraft(result.project.title);
      setSaveState("saved");
    } catch (caught) {
      setSaveState("error");
      toast.error(errorMessage(caught));
    }
  }

  async function toggleFavorite() {
    try {
      const result = await api<{ project: ProjectDetail }>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ favorite: !project.favorite }),
      });
      setProject((current) => ({ ...current, favorite: result.project.favorite }));
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  async function saveScene(sceneId: string, patch: Record<string, unknown>) {
    setSaveState("saving");
    try {
      const result = await api<{ scene: Scene }>(`/api/scenes/${sceneId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setScenes((current) => current.map((scene) => (scene.id === sceneId ? result.scene : scene)));
      setSaveState("saved");
    } catch (caught) {
      setSaveState("error");
      toast.error(errorMessage(caught));
    }
  }

  async function pollSceneJob(jobId: string, sceneId: string) {
    for (let attempt = 0; attempt < 220; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt < 2 ? 1500 : 3000));
      try {
        const data = await api<GenerateResponse>(`/api/jobs/${jobId}`);
        if (data.job.status === "succeeded") {
          await reload(sceneId);
          void refresh();
          toast.success("Scene ready.");
          return;
        }
        if (data.job.status === "failed" || data.job.status === "cancelled") {
          setError(data.job.error ?? "The scene could not be generated.");
          await reload(sceneId);
          return;
        }
      } catch (caught) {
        setError(errorMessage(caught));
        return;
      }
    }
    setError("The scene is taking longer than expected. Check Usage for its latest status.");
  }

  async function generateScene(scene: Scene) {
    if (!selectedModel) {
      toast.error("Choose a model first.");
      return;
    }
    if (!selectedModel.available) {
      toast.error("Connect a provider key before generating scenes.");
      return;
    }
    const prompt = (scene.prompt || scene.title).trim();
    if (prompt.length < 3) {
      toast.error("Add a prompt to this scene first.");
      return;
    }
    if (estimate > user.credits - user.reservedCredits) {
      toast.error("Not enough credits available for this generation.");
      return;
    }
    setSelectedId(scene.id);
    setGeneratingSceneId(scene.id);
    setError(null);
    setScenes((current) =>
      current.map((item) =>
        item.id === scene.id ? { ...item, status: "generating" as const, error: null } : item,
      ),
    );
    try {
      const response = await api<GenerateResponse>("/api/generate", {
        method: "POST",
        body: JSON.stringify({
          kind,
          model: selectedModel.id,
          prompt,
          aspectRatio: project.aspectRatio,
          resolution: resolution || selectedModel.resolutions[0],
          durationSeconds: kind === "video" ? selectedModel.durations[0] ?? 10 : undefined,
          outputCount: 1,
          generateAudio: selectedModel.supportsAudio ? generateAudio : false,
          projectId: project.id,
          sceneId: scene.id,
          referenceAssetIds: scene.referenceAssetIds,
          firstFrameAssetId: selectedModel.supportsFirstFrame ? scene.firstFrameAssetId : null,
          lastFrameAssetId: selectedModel.supportsLastFrame ? scene.lastFrameAssetId : null,
          idempotencyKey: newIdempotencyKey(),
        }),
      });
      if (response.job.status === "succeeded") {
        await reload(scene.id);
        void refresh();
        toast.success("Scene ready.");
      } else if (response.job.status === "failed" || response.job.status === "cancelled") {
        setError(response.job.error ?? "The scene could not be generated.");
        await reload(scene.id);
      } else {
        await pollSceneJob(response.job.id, scene.id);
      }
    } catch (caught) {
      setError(errorMessage(caught));
      setScenes((current) =>
        current.map((item) =>
          item.id === scene.id ? { ...item, status: "failed" as const, error: errorMessage(caught) } : item,
        ),
      );
    } finally {
      setGeneratingSceneId(null);
    }
  }

  async function duplicateScene(scene: Scene) {
    try {
      const result = await api<{ scene: Scene }>(`/api/scenes/${scene.id}/duplicate`, { method: "POST" });
      await reload(result.scene.id);
      toast.success("Scene duplicated.");
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  async function confirmDeleteScene() {
    if (!deletingScene) return;
    const sceneId = deletingScene.id;
    setDeletingScene(null);
    setBusy(true);
    try {
      await api(`/api/scenes/${sceneId}`, { method: "DELETE" });
      await reload(null);
      toast.success("Scene deleted.");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function addScene() {
    if (!newScene.prompt.trim() && !newScene.title.trim()) {
      toast.error("Give the scene a title or prompt.");
      return;
    }
    setAdding(true);
    try {
      const result = await api<{ scene: Scene }>(`/api/projects/${project.id}/scenes`, {
        method: "POST",
        body: JSON.stringify({
          title: newScene.title.trim() || `Scene ${scenes.length + 1}`,
          prompt: newScene.prompt.trim(),
          durationSeconds: Number(newScene.duration) || 10,
        }),
      });
      await reload(result.scene.id);
      setAddSceneOpen(false);
      setNewScene({ title: "", prompt: "", duration: "10" });
      toast.success("Scene added.");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setAdding(false);
    }
  }

  async function dropScene(targetId: string) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      return;
    }
    const from = scenes.findIndex((scene) => scene.id === draggingId);
    const to = scenes.findIndex((scene) => scene.id === targetId);
    if (from < 0 || to < 0) {
      setDraggingId(null);
      return;
    }
    const next = [...scenes];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setScenes(next.map((scene, index) => ({ ...scene, orderIndex: index })));
    setDraggingId(null);
    setSaveState("saving");
    try {
      await api(`/api/projects/${project.id}/scenes/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ sceneIds: next.map((scene) => scene.id) }),
      });
      setSaveState("saved");
    } catch (caught) {
      setSaveState("error");
      toast.error(errorMessage(caught));
      await reload();
    }
  }

  async function replaceSceneMedia(asset: Asset) {
    if (!replaceScene) return;
    setBusy(true);
    try {
      const patch =
        replaceScene && project.mode === "image"
          ? { thumbnailUrl: asset.url ?? `/api/media/${asset.id}`, status: "ready" as const }
          : { videoAssetId: asset.id, thumbnailUrl: asset.thumbnailUrl ?? null, status: "ready" as const };
      const result = await api<{ scene: Scene }>(`/api/scenes/${replaceScene.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setScenes((current) =>
        current.map((scene) => (scene.id === replaceScene.id ? result.scene : scene)),
      );
      setAssets((current) =>
        current.some((item) => item.id === asset.id) ? current : [asset, ...current],
      );
      setReplaceScene(null);
      toast.success("Scene media replaced.");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function duplicateProject() {
    setBusy(true);
    try {
      const result = await api<{ project: ProjectDetail }>(`/api/projects/${project.id}/duplicate`, {
        method: "POST",
      });
      toast.success("Project duplicated.");
      router.push(`/projects/${result.project.id}`);
    } catch (caught) {
      toast.error(errorMessage(caught));
      setBusy(false);
    }
  }

  async function exportProject() {
    setExporting(true);
    try {
      const result = await api<{ record: { id: string }; export: unknown }>(
        `/api/projects/${project.id}/export`,
        { method: "POST" },
      );
      const blob = new Blob([JSON.stringify(result.export, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slugify(project.title) || "whisk-flow"}-export.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Project exported as JSON.");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setExporting(false);
    }
  }

  async function deleteProject() {
    setBusy(true);
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      toast.success("Project moved to trash.");
      router.push("/projects");
      router.refresh();
    } catch (caught) {
      toast.error(errorMessage(caught));
      setBusy(false);
    }
  }

  async function setStatus(status: "draft" | "in_progress" | "complete") {
    try {
      const result = await api<{ project: ProjectDetail }>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setProject((current) => ({ ...current, status: result.project.status }));
      toast.success(`Project marked ${status.replace("_", " ")}.`);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  const videoAssetFor = (scene: Scene | null) =>
    scene?.videoAssetId ? assets.find((asset) => asset.id === scene.videoAssetId) ?? null : null;

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <div className="border-b border-border/70 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Link href="/projects" className="flex items-center gap-1 hover:text-foreground">
                <ArrowLeft className="size-3" /> Projects
              </Link>
              <span>/</span>
              <span className="capitalize">{project.mode}</span>
              {project.isExample ? <Badge variant="warning" className="text-[8px]">Example</Badge> : null}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={() => void saveTitle()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    setTitleDraft(project.title);
                    event.currentTarget.blur();
                  }
                }}
                maxLength={120}
                aria-label="Project title"
                className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xl font-semibold tracking-[-0.03em] outline-none transition-colors hover:border-border focus:border-ring/50 focus:ring-2 focus:ring-ring/15 sm:text-2xl"
              />
              <button
                onClick={() => void toggleFavorite()}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted",
                  project.favorite && "text-rose-500",
                )}
                aria-label={project.favorite ? "Remove from favorites" : "Add to favorites"}
              >
                <Heart className={cn("size-4", project.favorite && "fill-current")} />
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              <Badge variant={project.status === "complete" ? "success" : project.status === "in_progress" ? "default" : "secondary"} className="text-[8px] capitalize">
                {project.status.replace("_", " ")}
              </Badge>
              <span>{project.aspectRatio}</span>
              <span>·</span>
              <span>{scenes.length} scenes</span>
              <span>·</span>
              <span suppressHydrationWarning>Updated {formatDate(project.updatedAt)}</span>
              <AutosaveIndicator state={saveState} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => void exportProject()} loading={exporting}>
              <Download /> Export
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/create?project=${project.id}&mode=${project.mode === "image" ? "image" : "video"}`}>
                <Sparkles /> Generate
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="Project actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => void duplicateProject()}>
                  <Copy /> Duplicate project
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void setStatus("complete")}>
                  <Check /> Mark complete
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void setStatus("in_progress")}>
                  <RefreshCw /> Mark in progress
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void setStatus("draft")}>
                  <Clapperboard /> Mark draft
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteProjectOpen(true)}>
                  <Trash2 /> Move to trash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/50 px-2.5 py-2">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            <Settings2 className="size-3" /> Generation
          </span>
          <Select
            value={selectedModel?.id ?? ""}
            onChange={(event) => setModelId(event.target.value)}
            aria-label="Generation model"
            className="h-8 w-auto min-w-[160px]"
          >
            {models.length === 0 ? <option value="">No model</option> : null}
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
                {model.available ? "" : " (setup needed)"}
              </option>
            ))}
          </Select>
          <Select
            value={resolution || selectedModel?.resolutions[0] || ""}
            onChange={(event) => setResolution(event.target.value)}
            aria-label="Resolution"
            className="h-8 w-auto min-w-[92px]"
          >
            {(selectedModel?.resolutions ?? ["Auto"]).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          {selectedModel?.supportsAudio ? (
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Switch checked={generateAudio} onCheckedChange={setGenerateAudio} aria-label="Generate audio" />
              Audio
            </label>
          ) : null}
          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <Sparkles className="size-3 text-primary" /> {estimate} credits / scene
          </span>
          {setupNeeded ? (
            <Badge variant="warning" className="text-[8px]">
              Setup mode · generation off
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 p-4 sm:p-5">
          {error ? (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.06] p-3">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              <p className="min-w-0 flex-1 text-[10px] leading-relaxed text-destructive">{error}</p>
              <button onClick={() => setError(null)} className="text-destructive/60 hover:text-destructive" aria-label="Dismiss error">
                <X className="size-3.5" />
              </button>
            </div>
          ) : null}

          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Layers className="size-4 text-primary" /> Storyboard
              </h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Drag to reorder. Select a scene to edit prompts and generate.
              </p>
            </div>
            <Button size="sm" onClick={() => setAddSceneOpen(true)}>
              <Plus /> Add scene
            </Button>
          </div>

          {scenes.length > 0 ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {scenes.map((scene, index) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  index={index}
                  selected={scene.id === selectedId}
                  generating={generatingSceneId === scene.id}
                  videoAsset={videoAssetFor(scene)}
                  onSelect={() => selectScene(scene.id)}
                  onGenerate={() => void generateScene(scene)}
                  onDuplicate={() => void duplicateScene(scene)}
                  onDelete={() => setDeletingScene(scene)}
                  onReplace={() => setReplaceScene(scene)}
                  onDragStart={() => setDraggingId(scene.id)}
                  onDrop={() => void dropScene(scene.id)}
                  dragging={draggingId === scene.id}
                />
              ))}
              <button
                onClick={() => setAddSceneOpen(true)}
                className="flex min-h-[190px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 p-4 text-center transition-colors hover:border-primary/30 hover:bg-card/60"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Plus className="size-4" />
                </span>
                <span className="mt-2 text-xs font-semibold">Add a scene</span>
                <span className="mt-0.5 text-[10px] text-muted-foreground">Write it, then generate</span>
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 py-16 text-center">
              <Layers className="size-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">This storyboard is empty</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Add the first scene. You can write a prompt, attach references and generate a frame
                or clip when a model is connected.
              </p>
              <Button className="mt-4" size="sm" onClick={() => setAddSceneOpen(true)}>
                <Plus /> Add the first scene
              </Button>
            </div>
          )}

          <Timeline
            scenes={scenes}
            assets={assets}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpenAsset={setLightboxAsset}
            projectMode={project.mode}
          />
        </div>

        <aside ref={inspectorRef} className="scroll-mt-16 border-t border-border/70 bg-card/25 lg:border-l lg:border-t-0">
          <div className="sticky top-16 flex max-h-[calc(100dvh-4rem)] flex-col">
            <div className="flex h-11 items-center justify-between border-b border-border/70 px-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Scene inspector
              </p>
              {selectedScene ? (
                <Badge variant="outline" className="text-[8px]">
                  {String(scenes.findIndex((scene) => scene.id === selectedScene.id) + 1).padStart(2, "0")}
                </Badge>
              ) : null}
            </div>
            {selectedScene ? (
              <SceneInspector
                key={selectedScene.id}
                scene={selectedScene}
                assets={assets}
                model={selectedModel}
                generating={generatingSceneId === selectedScene.id}
                onSave={(patch) => saveScene(selectedScene.id, patch)}
                onGenerate={() => void generateScene(selectedScene)}
                onDuplicate={() => void duplicateScene(selectedScene)}
                onDelete={() => setDeletingScene(selectedScene)}
                onReplace={() => setReplaceScene(selectedScene)}
                onAddAsset={(uploaded) => {
                  setAssets((current) => [...uploaded, ...current]);
                  setPickerAssets((current) => [...uploaded, ...current]);
                }}
              />
            ) : (
              <InspectorEmpty
                title="Select a scene"
                description="Choose a storyboard scene to edit its prompt, references, timing and generation settings."
              />
            )}
          </div>
        </aside>
      </div>

      <Dialog open={addSceneOpen} onOpenChange={setAddSceneOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a scene</DialogTitle>
            <DialogDescription>Set the intent now. Everything stays editable and autosaves.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-scene-title">Scene title</Label>
              <Input
                id="new-scene-title"
                value={newScene.title}
                onChange={(event) => setNewScene((current) => ({ ...current, title: event.target.value }))}
                placeholder={`Scene ${scenes.length + 1}`}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-scene-prompt">Prompt</Label>
              <Textarea
                id="new-scene-prompt"
                value={newScene.prompt}
                onChange={(event) => setNewScene((current) => ({ ...current, prompt: event.target.value }))}
                rows={4}
                maxLength={4000}
                placeholder="Describe the shot, subject, camera and mood…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-scene-duration">Timeline duration (seconds)</Label>
              <Input
                id="new-scene-duration"
                type="number"
                min={1}
                max={20}
                value={newScene.duration}
                onChange={(event) => setNewScene((current) => ({ ...current, duration: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSceneOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void addScene()} loading={adding}>
              <Plus /> Add scene
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={replaceScene !== null} onOpenChange={(open) => (!open ? setReplaceScene(null) : undefined)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Replace scene media</DialogTitle>
            <DialogDescription>
              Choose {project.mode === "image" ? "an image" : "a video"} from your media library.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[52dvh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
            {pickerAssets
              .filter((asset) => asset.kind === (project.mode === "image" ? "image" : "video"))
              .map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => void replaceSceneMedia(asset)}
                  disabled={busy}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border/70 bg-muted transition-colors hover:border-primary/40 disabled:opacity-50"
                >
                  <AssetPreview asset={asset} />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-3 text-[8px] text-white">
                    {asset.title}
                  </span>
                </button>
              ))}
            {pickerAssets.filter((asset) => asset.kind === (project.mode === "image" ? "image" : "video")).length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-border p-6 text-center">
                <ImageIcon className="mx-auto size-4 text-muted-foreground" />
                <p className="mt-2 text-[11px] font-medium">No matching media</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Upload or generate a {project.mode === "image" ? "frame" : "clip"} first.
                </p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceScene(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingScene !== null} onOpenChange={(open) => (!open ? setDeletingScene(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this scene?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletingScene?.title}” will be removed from the storyboard. Generated media stays in
              your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep scene</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDeleteScene()}>Delete scene</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteProjectOpen} onOpenChange={setDeleteProjectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move project to trash?</AlertDialogTitle>
            <AlertDialogDescription>
              You can restore “{project.title}” from Trash. Media in your library is not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep project</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteProject()} disabled={busy}>
              Move to trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AssetLightbox
        asset={lightboxAsset}
        open={lightboxAsset !== null}
        onOpenChange={(open) => {
          if (!open) setLightboxAsset(null);
        }}
      />
    </div>
  );
}

function SceneCard({
  scene,
  index,
  selected,
  generating,
  videoAsset,
  onSelect,
  onGenerate,
  onDuplicate,
  onDelete,
  onReplace,
  onDragStart,
  onDrop,
  dragging,
}: {
  scene: Scene;
  index: number;
  selected: boolean;
  generating: boolean;
  videoAsset: Asset | null;
  onSelect: () => void;
  onGenerate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReplace: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  dragging: boolean;
}) {
  const thumbnail = scene.thumbnailUrl ?? videoAsset?.thumbnailUrl ?? null;

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={cn(
        "group overflow-hidden p-0 transition-all",
        selected ? "border-primary/40 ring-2 ring-primary/20" : "hover:border-primary/20",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-2.5 py-1.5">
        <button onClick={onSelect} className="flex min-w-0 items-center gap-1.5 text-left">
          <GripVertical className="size-3 shrink-0 cursor-grab text-muted-foreground/40" />
          <span className="text-[9px] font-semibold text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="truncate text-[11px] font-semibold">{scene.title}</span>
        </button>
        <div className="flex items-center gap-1">
          <SceneStatusBadge status={scene.status} className="px-1.5 py-0 text-[8px]" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground" aria-label={`Actions for ${scene.title}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={onGenerate}>
                <Sparkles /> Generate
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDuplicate}>
                <Copy /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onReplace}>
                <RefreshCw /> Replace media
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <button onClick={onSelect} className="block w-full text-left" aria-label={`Select ${scene.title}`}>
        <div className="relative aspect-video overflow-hidden bg-muted">
          {generating ? (
            <div className="flex size-full flex-col items-center justify-center bg-[#0b0b11] text-white">
              <Loader2 className="size-5 animate-spin text-[#b8a6ff]" />
              <span className="mt-2 text-[9px] text-white/60">Generating scene…</span>
            </div>
          ) : videoAsset ? (
            <video
              src={videoAsset.url ?? ""}
              poster={thumbnail ?? undefined}
              muted
              loop
              playsInline
              preload="metadata"
              className="size-full object-cover"
            />
          ) : thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-primary/8 via-muted to-blue-500/8 text-muted-foreground">
              <ImageIcon className="size-5" />
              <span className="text-[8px] uppercase tracking-wider">No frame yet</span>
            </div>
          )}
          {scene.status === "failed" ? (
            <span className="absolute inset-x-0 bottom-0 bg-destructive/85 px-2 py-1 text-[8px] text-white">
              {truncate(scene.error ?? "Generation failed", 80)}
            </span>
          ) : null}
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[8px] font-medium text-white backdrop-blur">
            {scene.durationSeconds}s · {scene.transition}
          </span>
        </div>
      </button>

      <div className="p-2.5">
        <p className="line-clamp-2 min-h-[26px] text-[10px] leading-relaxed text-muted-foreground">
          {scene.prompt || "No prompt yet. Select the scene to write one."}
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <Button
            size="sm"
            variant={scene.status === "ready" ? "outline" : "default"}
            className="h-7 flex-1 text-[10px]"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? <Loader2 className="animate-spin" /> : scene.status === "ready" ? <RefreshCw /> : <Sparkles />}
            {generating ? "Generating…" : scene.status === "ready" ? "Regenerate" : "Generate"}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" className="size-7" onClick={onSelect} aria-label="Edit scene">
                <Settings2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit scene</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
}

function SceneInspector({
  scene,
  assets,
  model,
  generating,
  onSave,
  onGenerate,
  onDuplicate,
  onDelete,
  onReplace,
  onAddAsset,
}: {
  scene: Scene;
  assets: Asset[];
  model: PublicModel | undefined;
  generating: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  onGenerate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReplace: () => void;
  onAddAsset: (assets: Asset[]) => void;
}) {
  const [draft, setDraft] = React.useState({
    title: scene.title,
    prompt: scene.prompt,
    negativePrompt: scene.negativePrompt,
    durationSeconds: scene.durationSeconds,
    transition: scene.transition,
    referenceAssetIds: scene.referenceAssetIds,
    firstFrameAssetId: scene.firstFrameAssetId,
    lastFrameAssetId: scene.lastFrameAssetId,
  });
  const dirty = React.useRef(false);
  const onSaveRef = React.useRef(onSave);
  const [picker, setPicker] = React.useState<"references" | "first" | "last" | null>(null);

  React.useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  React.useEffect(() => {
    setDraft({
      title: scene.title,
      prompt: scene.prompt,
      negativePrompt: scene.negativePrompt,
      durationSeconds: scene.durationSeconds,
      transition: scene.transition,
      referenceAssetIds: scene.referenceAssetIds,
      firstFrameAssetId: scene.firstFrameAssetId,
      lastFrameAssetId: scene.lastFrameAssetId,
    });
    dirty.current = false;
  }, [
    scene.id,
    scene.updatedAt,
    scene.title,
    scene.prompt,
    scene.negativePrompt,
    scene.durationSeconds,
    scene.transition,
    scene.referenceAssetIds,
    scene.firstFrameAssetId,
    scene.lastFrameAssetId,
  ]);

  React.useEffect(() => {
    if (!dirty.current) return;
    const timeout = setTimeout(() => {
      dirty.current = false;
      void onSaveRef.current(draft);
    }, 850);
    return () => clearTimeout(timeout);
  }, [draft]);

  function update(patch: Partial<typeof draft>) {
    dirty.current = true;
    setDraft((current) => ({ ...current, ...patch }));
  }

  const referenceAssets = assets.filter((asset) => draft.referenceAssetIds.includes(asset.id));
  const firstFrame = assets.find((asset) => asset.id === draft.firstFrameAssetId) ?? null;
  const lastFrame = assets.find((asset) => asset.id === draft.lastFrameAssetId) ?? null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <SceneStatusBadge status={scene.status} />
          <span className="text-[9px] text-muted-foreground">{scene.durationSeconds}s</span>
        </div>

        {scene.error ? (
          <p className="rounded-lg border border-destructive/20 bg-destructive/[0.06] p-2 text-[9px] leading-relaxed text-destructive">
            {scene.error}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="scene-title" className="text-[10px]">Scene title</Label>
          <Input
            id="scene-title"
            value={draft.title}
            onChange={(event) => update({ title: event.target.value })}
            maxLength={120}
            className="h-8 text-[11px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="scene-prompt" className="text-[10px]">Prompt</Label>
          <Textarea
            id="scene-prompt"
            value={draft.prompt}
            onChange={(event) => update({ prompt: event.target.value })}
            rows={5}
            maxLength={4000}
            placeholder="Describe the shot…"
            className="min-h-[100px] text-[11px] leading-relaxed"
          />
          <p className="text-right text-[9px] text-muted-foreground">{draft.prompt.length}/4000</p>
        </div>

        {model?.supportsNegativePrompt ? (
          <div className="space-y-1.5">
            <Label htmlFor="scene-negative" className="text-[10px]">Negative prompt</Label>
            <Textarea
              id="scene-negative"
              value={draft.negativePrompt}
              onChange={(event) => update({ negativePrompt: event.target.value })}
              rows={2}
              maxLength={1000}
              className="min-h-[52px] text-[11px]"
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="scene-transition" className="text-[10px]">Transition</Label>
            <Select
              id="scene-transition"
              value={draft.transition}
              onChange={(event) => update({ transition: event.target.value as typeof draft.transition })}
            >
              <option value="cut">Cut</option>
              <option value="fade">Fade</option>
              <option value="dissolve">Dissolve</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scene-duration" className="text-[10px]">Timeline length</Label>
            <Input
              id="scene-duration"
              type="number"
              min={1}
              max={20}
              value={draft.durationSeconds}
              onChange={(event) => update({ durationSeconds: Math.max(1, Math.min(20, Number(event.target.value) || 1)) })}
              className="h-9 text-[11px]"
            />
          </div>
        </div>
        <p className="flex items-start gap-1.5 text-[9px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-2.5 shrink-0" />
          Timeline length shapes the board. The provider currently renders fixed {model?.durations[0] ?? 10}s clips.
        </p>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">References</p>
            <button onClick={() => setPicker("references")} className="text-[9px] font-medium text-primary hover:underline">
              Add
            </button>
          </div>
          {referenceAssets.length > 0 ? (
            <div className="grid grid-cols-4 gap-1.5">
              {referenceAssets.map((asset) => (
                <div key={asset.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border/70 bg-muted">
                  <AssetPreview asset={asset} />
                  <button
                    onClick={() => update({ referenceAssetIds: draft.referenceAssetIds.filter((id) => id !== asset.id) })}
                    className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100"
                    aria-label={`Remove ${asset.title}`}
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-2 text-center text-[9px] text-muted-foreground">
              No references. Images guide identity and style.
            </p>
          )}
          {model?.supportsFirstFrame || model?.supportsLastFrame ? (
            <div className="grid grid-cols-2 gap-2">
              <FrameSlot label="First frame" asset={firstFrame} onPick={() => setPicker("first")} onClear={() => update({ firstFrameAssetId: null })} />
              <FrameSlot label="Last frame" asset={lastFrame} onPick={() => setPicker("last")} onClear={() => update({ lastFrameAssetId: null })} />
            </div>
          ) : null}
        </div>

        <Separator />

        <div className="space-y-2">
          <Button className="w-full" onClick={onGenerate} loading={generating}>
            {!generating ? <Sparkles /> : null}
            {generating ? "Generating scene…" : "Generate scene"}
          </Button>
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant="outline" size="sm" onClick={onReplace} disabled={generating}>
              <RefreshCw /> Replace
            </Button>
            <Button variant="outline" size="sm" onClick={onDuplicate} disabled={generating}>
              <Copy /> Duplicate
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive" onClick={onDelete} disabled={generating}>
            <Trash2 /> Delete scene
          </Button>
        </div>
      </div>

      <ReferencePickerDialog
        open={picker !== null}
        onOpenChange={(open) => {
          if (!open) setPicker(null);
        }}
        assets={assets}
        onUploaded={onAddAsset}
        multiple={picker === "references"}
        max={8}
        title={picker === "first" ? "Choose the first frame" : picker === "last" ? "Choose the last frame" : "Add scene references"}
        description={
          picker === "first" || picker === "last"
            ? "This frame anchors the start or end of the generated clip."
            : "Choose stills that guide this scene."
        }
        onConfirm={(chosen) => {
          if (chosen.length === 0) return;
          if (picker === "first") update({ firstFrameAssetId: chosen[0].id });
          else if (picker === "last") update({ lastFrameAssetId: chosen[0].id });
          else {
            update({
              referenceAssetIds: [...new Set([...draft.referenceAssetIds, ...chosen.map((asset) => asset.id)])].slice(0, 8),
            });
          }
        }}
      />
    </div>
  );
}

function FrameSlot({
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
            className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100"
            aria-label={`Clear ${label}`}
          >
            <X className="size-2.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={onPick}
          className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
        >
          <ImagePlus className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function Timeline({
  scenes,
  assets,
  selectedId,
  onSelect,
  onOpenAsset,
  projectMode,
}: {
  scenes: Scene[];
  assets: Asset[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenAsset: (asset: Asset) => void;
  projectMode: string;
}) {
  const [playIndex, setPlayIndex] = React.useState<number | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(true);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const selectedIndex = Math.max(0, scenes.findIndex((scene) => scene.id === selectedId));
  const activeIndex = isPlaying && playIndex !== null ? playIndex : selectedIndex;
  const activeScene = scenes[activeIndex] ?? null;
  const activeVideo = activeScene?.videoAssetId
    ? assets.find((asset) => asset.id === activeScene.videoAssetId) ?? null
    : null;
  const totalDuration = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);

  React.useEffect(() => {
    if (scenes.length === 0) {
      setPlayIndex(null);
      setIsPlaying(false);
      return;
    }
    if (playIndex !== null && playIndex >= scenes.length) {
      setPlayIndex(null);
      setIsPlaying(false);
    }
  }, [scenes.length, playIndex]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [isPlaying, activeIndex, activeVideo?.id]);

  React.useEffect(() => {
    if (!isPlaying || !activeScene || activeVideo) return;
    const timeout = setTimeout(() => advance(), Math.max(1, activeScene.durationSeconds) * 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, activeIndex, activeVideo?.id, activeScene?.durationSeconds]);

  function advance() {
    if (playIndex === null) {
      setIsPlaying(false);
      return;
    }
    if (playIndex + 1 >= scenes.length) {
      setIsPlaying(false);
      setPlayIndex(null);
      return;
    }
    setPlayIndex(playIndex + 1);
  }

  function togglePlay() {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    const start = selectedIndex >= 0 ? selectedIndex : 0;
    setPlayIndex(start);
    setIsPlaying(true);
  }

  function step(direction: -1 | 1) {
    if (scenes.length === 0) return;
    const next = Math.max(0, Math.min(scenes.length - 1, activeIndex + direction));
    setPlayIndex(next);
    onSelect(scenes[next].id);
    if (isPlaying) setIsPlaying(true);
  }

  return (
    <Card className="mt-5 overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <Film className="size-3.5 text-primary" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Timeline</p>
          <Badge variant="outline" className="text-[8px]">{formatDuration(totalDuration)}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => step(-1)} disabled={scenes.length === 0} aria-label="Previous scene">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={togglePlay} disabled={scenes.length === 0} aria-label={isPlaying ? "Pause sequence" : "Play sequence"}>
            {isPlaying ? <Pause /> : <Play />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => step(1)} disabled={scenes.length === 0} aria-label="Next scene">
            <ChevronRight />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="relative aspect-video bg-[#0b0b11] lg:aspect-auto lg:min-h-[180px]">
          {activeVideo ? (
            <video
              key={activeVideo.id}
              ref={videoRef}
              src={activeVideo.url ?? ""}
              poster={activeVideo.thumbnailUrl ?? activeScene?.thumbnailUrl ?? undefined}
              muted={muted}
              playsInline
              onEnded={advance}
              className="size-full object-cover"
            />
          ) : activeScene?.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activeScene.thumbnailUrl} alt={activeScene.title} className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1.5 text-white/40">
              <Clapperboard className="size-5" />
              <span className="text-[9px]">
                {projectMode === "image" ? "Select a frame" : "Generate a clip to preview"}
              </span>
            </div>
          )}
          {activeVideo ? (
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity hover:opacity-100"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur">
                {isPlaying ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4 fill-current" />}
              </span>
            </button>
          ) : null}
          {activeScene ? (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-5 text-[8px] text-white">
              <span className="truncate font-medium">{activeScene.title}</span>
              <span>{activeScene.durationSeconds}s</span>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 p-3">
          <div className="flex gap-1.5 overflow-x-auto pb-2">
            {scenes.map((scene, index) => {
              const asset = scene.videoAssetId ? assets.find((item) => item.id === scene.videoAssetId) : null;
              const thumb = scene.thumbnailUrl ?? asset?.thumbnailUrl ?? null;
              const isActive = index === activeIndex;
              return (
                <button
                  key={scene.id}
                  onClick={() => {
                    onSelect(scene.id);
                    if (isPlaying) setPlayIndex(index);
                  }}
                  className={cn(
                    "relative h-14 min-w-[80px] flex-1 overflow-hidden rounded-md border bg-muted text-left transition-all",
                    isActive ? "border-primary ring-2 ring-primary/25" : "border-border/70 hover:border-primary/30",
                  )}
                  style={{ flexGrow: Math.max(1, scene.durationSeconds) }}
                  aria-label={`Jump to ${scene.title}`}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center bg-gradient-to-br from-primary/10 to-blue-500/10">
                      <ImageIcon className="size-3 text-muted-foreground" />
                    </span>
                  )}
                  <span className="absolute inset-0 bg-black/20" />
                  <span className="absolute left-1 top-1 rounded bg-black/55 px-1 text-[7px] font-medium text-white">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1 text-[7px] text-white">
                    {scene.durationSeconds}s
                  </span>
                  {isActive && isPlaying ? (
                    <span className="absolute inset-0 border-b-2 border-primary" />
                  ) : null}
                </button>
              );
            })}
            {scenes.length === 0 ? (
              <div className="flex h-14 flex-1 items-center justify-center rounded-md border border-dashed border-border text-[9px] text-muted-foreground">
                Add scenes to build the timeline
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between text-[9px] text-muted-foreground">
            <span>
              Scene {scenes.length === 0 ? 0 : activeIndex + 1} of {scenes.length}
            </span>
            <div className="flex items-center gap-1">
              {activeVideo ? (
                <button onClick={() => onOpenAsset(activeVideo)} className="flex items-center gap-1 hover:text-foreground">
                  <Maximize2 className="size-2.5" /> Expand clip
                </button>
              ) : null}
              <span>·</span>
              <span>{formatDuration(totalDuration)} sequence</span>
            </div>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full accent-gradient transition-[width] duration-500"
              style={{ width: `${scenes.length === 0 ? 0 : ((activeIndex + 1) / scenes.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
