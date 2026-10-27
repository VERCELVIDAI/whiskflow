"use client";

import * as React from "react";
import {
  Aperture,
  Camera,
  Check,
  Copy,
  Film,
  Languages,
  Loader2,
  Scissors,
  Shuffle,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/client-api";
import { cn } from "@/lib/utils";

type PromptAction = "enhance" | "cinematic" | "realistic" | "camera" | "variations" | "simplify" | "translate";

const ACTIONS: Array<{ id: PromptAction; label: string; icon: typeof Sparkles; hint: string }> = [
  { id: "enhance", label: "Enhance", icon: Sparkles, hint: "Add production detail" },
  { id: "cinematic", label: "Cinematic", icon: Film, hint: "Camera, light, texture" },
  { id: "realistic", label: "Photoreal", icon: Aperture, hint: "Natural realism" },
  { id: "camera", label: "Camera", icon: Camera, hint: "Lens and movement" },
  { id: "variations", label: "Variations", icon: Shuffle, hint: "Three directions" },
  { id: "simplify", label: "Simplify", icon: Scissors, hint: "Short and clear" },
  { id: "translate", label: "Translate", icon: Languages, hint: "Another language" },
];

const LANGUAGES = ["English", "Spanish", "French", "German", "Japanese", "Korean", "Portuguese", "Italian", "Hindi", "Arabic"];

interface AssistantResult {
  text: string;
  source: "provider" | "local";
  provider: string | null;
  model: string | null;
  note: string;
}

export function PromptAssistantDialog({
  open,
  onOpenChange,
  prompt,
  mode,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  mode: "image" | "video";
  onApply: (text: string) => void;
}) {
  const [action, setAction] = React.useState<PromptAction>("enhance");
  const [language, setLanguage] = React.useState("English");
  const [result, setResult] = React.useState<AssistantResult | null>(null);
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setResult(null);
      setDraft("");
    }
  }, [open]);

  async function run(nextAction: PromptAction = action) {
    if (prompt.trim().length < 2) {
      toast.error("Add an idea to the prompt first.");
      return;
    }
    setAction(nextAction);
    setLoading(true);
    try {
      const data = await api<AssistantResult>("/api/prompt-assistant", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          action: nextAction,
          mode,
          targetLanguage: language,
        }),
      });
      setResult(data);
      setDraft(data.text);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Could not access the clipboard.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="size-4 text-primary" /> Prompt assistant
          </DialogTitle>
          <DialogDescription>
            Sharpen an idea into a production-ready prompt. You always decide what gets used.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Your idea
          </p>
          <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-foreground/80">
            {prompt.trim() || "Add a prompt in the composer first."}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ACTIONS.map((item) => (
            <button
              key={item.id}
              onClick={() => void run(item.id)}
              disabled={loading}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50",
                action === item.id && result
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/70 bg-card text-muted-foreground hover:text-foreground",
              )}
              title={item.hint}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </button>
          ))}
          {action === "translate" ? (
            <Select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              aria-label="Target language"
              className="h-8 w-28"
            >
              {LANGUAGES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10">
            <Loader2 className="size-5 animate-spin text-primary" />
            <p className="mt-3 text-xs font-medium">Working on the prompt…</p>
            <p className="mt-1 text-[10px] text-muted-foreground">This takes a few seconds.</p>
          </div>
        ) : result ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Result
              </p>
              <div className="flex items-center gap-1.5">
                <Badge variant={result.source === "provider" ? "success" : "warning"} className="text-[8px]">
                  {result.source === "provider" ? `${result.provider} · ${result.model}` : "Local fallback"}
                </Badge>
                <Button variant="ghost" size="icon-sm" onClick={copy} aria-label="Copy result">
                  <Copy />
                </Button>
              </div>
            </div>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={6}
              className="font-mono text-[11px] leading-relaxed"
              aria-label="Assistant result"
            />
            <p className="text-[10px] leading-relaxed text-muted-foreground">{result.note}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <Wand2 className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-xs font-medium">Choose an assistant action</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Enhance, direct the camera, or explore three variations.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <p className="hidden text-[10px] text-muted-foreground sm:block">
            {result?.source === "local"
              ? "No LLM key configured — this uses the local prompt engine."
              : "Prompts are sent only to your configured provider."}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!draft.trim() || loading}
              onClick={() => {
                onApply(draft.trim());
                onOpenChange(false);
                toast.success("Prompt applied.");
              }}
            >
              <Check /> Use prompt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
