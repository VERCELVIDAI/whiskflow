"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clapperboard,
  ImageIcon,
  LayoutTemplate,
  Play,
  Search,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Template } from "@/lib/types";

const MODE_LABEL: Record<Template["mode"], string> = {
  video: "Video",
  image: "Image",
  storyboard: "Storyboard",
};

export function TemplatesGallery({
  templates,
  initialSlug,
}: {
  templates: Template[];
  initialSlug?: string | null;
}) {
  const router = useRouter();
  const initialTemplate = initialSlug ? templates.find((template) => template.slug === initialSlug) : undefined;
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<Template["mode"] | "all">("all");
  const [category, setCategory] = React.useState<string>("all");
  const [preview, setPreview] = React.useState<Template | null>(initialTemplate ?? null);
  const [promptDraft, setPromptDraft] = React.useState(initialTemplate?.prompt ?? "");

  const categories = React.useMemo(
    () => [...new Set(templates.map((template) => template.category))].sort(),
    [templates],
  );

  const filtered = templates.filter((template) => {
    const haystack = `${template.title} ${template.description} ${template.tags.join(" ")}`.toLowerCase();
    return (
      (!query.trim() || haystack.includes(query.trim().toLowerCase())) &&
      (mode === "all" || template.mode === mode) &&
      (category === "all" || template.category === category)
    );
  });

  function openPreview(template: Template) {
    setPreview(template);
    setPromptDraft(template.prompt);
  }

  function useTemplate() {
    if (!preview) return;
    const params = new URLSearchParams({
      template: preview.slug,
      mode: preview.mode,
    });
    if (promptDraft.trim()) params.set("prompt", promptDraft.trim());
    setPreview(null);
    router.push(`/create?${params.toString()}`);
  }

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/50 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search templates by title, style or mood…"
            className="h-9 pl-8 text-xs"
            aria-label="Search templates"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "video", "image", "storyboard"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setMode(item)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors",
                mode === item ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-pressed={mode === item}
            >
              {item === "all" ? "All modes" : MODE_LABEL[item]}
            </button>
          ))}
          <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by category"
            className="h-9 w-auto min-w-[130px]"
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "template" : "templates"} · example starting points
          with fully editable prompts
        </p>
        <span className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
          <Sparkles className="size-3" /> Sample imagery is illustrative
        </span>
      </div>

      {filtered.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((template) => (
            <article
              key={template.slug}
              className="group overflow-hidden rounded-2xl border border-border/70 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_20px_50px_-24px_rgba(60,40,140,0.35)]"
            >
              <button
                onClick={() => openPreview(template)}
                className="relative block aspect-[16/10] w-full overflow-hidden text-left"
                aria-label={`Preview ${template.title}`}
              >
                {template.video ? (
                  <video
                    src={template.video}
                    poster={template.poster}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-hidden="true"
                    className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    onMouseEnter={(event) => {
                      void event.currentTarget.play().catch(() => undefined);
                    }}
                    onMouseLeave={(event) => {
                      const video = event.currentTarget;
                      video.pause();
                      video.currentTime = 0;
                    }}
                  />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={template.poster}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  </>
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
                <span className="absolute left-3 top-3 flex gap-1.5">
                  <Badge variant="secondary" className="bg-black/40 text-[8px] uppercase tracking-wider text-white backdrop-blur">
                    {MODE_LABEL[template.mode]}
                  </Badge>
                  {template.video ? (
                    <Badge
                      variant="secondary"
                      className="gap-1 bg-white/15 text-[8px] text-white backdrop-blur"
                    >
                      <Play className="size-2.5" fill="currentColor" /> Preview
                    </Badge>
                  ) : null}
                  {template.featured ? (
                    <Badge variant="secondary" className="bg-white/20 text-[8px] text-white backdrop-blur">
                      Featured
                    </Badge>
                  ) : null}
                </span>
                <span className="absolute bottom-3 left-3 right-3">
                  <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-white/60">
                    {template.category}
                  </span>
                  <span className="mt-0.5 block text-base font-semibold tracking-tight text-white">
                    {template.title}
                  </span>
                </span>
                <span className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                  <ArrowRight className="size-3.5" />
                </span>
              </button>
              <div className="p-4">
                <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                  {template.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {template.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[8px]">
                      {tag}
                    </Badge>
                  ))}
                  <span className="ml-auto text-[9px] text-muted-foreground">{template.aspectRatio}</span>
                </div>
                <Button className="mt-3 w-full" variant="outline" size="sm" onClick={() => openPreview(template)}>
                  <Wand2 /> Use template
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-4"
          icon={LayoutTemplate}
          title="No templates match"
          description="Try a different search term, mode or category."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setMode("all");
                setCategory("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      )}

      <Dialog open={preview !== null} onOpenChange={(open) => (!open ? setPreview(null) : undefined)}>
        <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-3xl overflow-y-auto p-0">
          {preview ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>{preview.title}</DialogTitle>
                <DialogDescription>Preview and customize this template</DialogDescription>
              </DialogHeader>
              <div className="relative aspect-[16/9] overflow-hidden">
                {preview.video ? (
                  <video
                    src={preview.video}
                    poster={preview.poster}
                    muted
                    loop
                    playsInline
                    controls
                    preload="metadata"
                    className="size-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.poster} alt="" className="size-full object-cover" />
                )}
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div
                  className={cn(
                    "pointer-events-none absolute bottom-4 left-4 right-4",
                    preview.video && "bottom-14",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="bg-black/40 text-[9px] uppercase tracking-wider text-white backdrop-blur">
                      {MODE_LABEL[preview.mode]}
                    </Badge>
                    <Badge variant="secondary" className="bg-black/40 text-[9px] text-white backdrop-blur">
                      {preview.category}
                    </Badge>
                    <span className="text-[9px] text-white/60">
                      {preview.video ? "Video template" : "Illustrative sample"}
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-white">{preview.title}</h2>
                  <p className="mt-1 max-w-xl text-xs text-white/70">{preview.description}</p>
                </div>
              </div>
              <div className="space-y-4 p-5">
                <div className="space-y-2">
                  <Label htmlFor="template-prompt">Starting prompt</Label>
                  <Textarea
                    id="template-prompt"
                    value={promptDraft}
                    onChange={(event) => setPromptDraft(event.target.value)}
                    rows={5}
                    maxLength={4000}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Edit the brief before opening it in Create. Every setting stays editable there.
                  </p>
                </div>
                <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/30 p-3 text-[10px] sm:grid-cols-3">
                  <div>
                    <p className="text-muted-foreground">Aspect ratio</p>
                    <p className="mt-0.5 font-medium">{preview.aspectRatio}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Style</p>
                    <p className="mt-0.5 font-medium capitalize">{preview.stylePreset ?? "Your choice"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Structure</p>
                    <p className="mt-0.5 font-medium">
                      {preview.scenes?.length ? `${preview.scenes.length} scenes` : "Single output"}
                    </p>
                  </div>
                </div>
                {preview.scenes?.length ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Scene plan
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {preview.scenes.map((scene, index) => (
                        <div key={`${scene.title}-${index}`} className="flex items-start gap-2 rounded-lg border border-border/70 bg-card p-2.5">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[9px] font-semibold text-muted-foreground">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium">{scene.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{scene.prompt}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <DialogFooter className="border-t border-border p-4">
                <Button variant="outline" onClick={() => setPreview(null)}>
                  Cancel
                </Button>
                <Button onClick={useTemplate} disabled={!promptDraft.trim()}>
                  {preview.mode === "image" ? <ImageIcon /> : preview.mode === "storyboard" ? <Clapperboard /> : <Sparkles />}
                  Open in Create <ArrowRight />
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
