import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CircleHelp,
  Clapperboard,
  Coins,
  Command,
  Images,
  KeyRound,
  Layers,
  LockKeyhole,
  MousePointerClick,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { authMode } from "@/lib/auth";
import { getProviderCatalog } from "@/lib/providers/models";
import { PageHeader } from "@/components/studio/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCredits } from "@/lib/utils";

export const metadata: Metadata = { title: "Help" };
export const dynamic = "force-dynamic";

const GUIDES = [
  {
    href: "/create?mode=video",
    title: "Generate a video",
    description: "Write a prompt or drop a first frame, choose a model, then generate a cinematic clip with native audio.",
    icon: Clapperboard,
  },
  {
    href: "/create?mode=image",
    title: "Create a still",
    description: "Text-to-image or image-to-image with references, ratios, styles and up to four outputs per run.",
    icon: Images,
  },
  {
    href: "/create?mode=storyboard",
    title: "Build a storyboard",
    description: "Plan scenes, reorder the sequence, generate frames and preview the timeline before exporting.",
    icon: Layers,
  },
  {
    href: "/templates",
    title: "Start from a template",
    description: "Use a curated brief with editable prompt, ratio and scene structure, then make it yours.",
    icon: Sparkles,
  },
];

const SHORTCUTS = [
  { keys: ["Ctrl", "K"], mac: ["⌘", "K"], label: "Open command palette" },
  { keys: ["Esc"], mac: ["Esc"], label: "Close dialogs and menus" },
  { keys: ["Tab"], mac: ["Tab"], label: "Move through controls" },
  { keys: ["Enter"], mac: ["Return"], label: "Confirm focused action" },
  { keys: ["Space"], mac: ["Space"], label: "Toggle focused control" },
];

const FAQS = [
  {
    question: "Why is generation disabled?",
    answer:
      "The studio runs fully without provider keys. Generation turns on when GEMINI_API_KEY, OPENAI_API_KEY or JSON2VIDEO_API_KEY is set on the server. Add a key to .env.local, restart the app, then refresh Settings → AI providers.",
  },
  {
    question: "How do credits work?",
    answer:
      "Credits are Whisk Flow units, not provider USD. The server reserves credits before a job starts, captures them on success, and releases them if a job fails or is cancelled. Every movement is written to the ledger on the Usage page.",
  },
  {
    question: "Why does my Whisk Flow 1.1 video have a watermark?",
    answer:
      "Whisk Flow 1.1 renders through JSON2Video. JSON2Video adds its watermark to free-plan renders; paid JSON2Video plans remove it. The watermark is part of the provider output, so do not crop or cover it on free-plan renders.",
  },
  {
    question: "Where are my files stored?",
    answer:
      "In local mode, media lives under .data/uploads and is served through an authenticated route. In cloud mode, files go to a private Supabase Storage bucket and are read through signed access or the media route. Files are never public.",
  },
  {
    question: "What happens when I delete something?",
    answer:
      "Projects and media move to Trash first. Restore them from Trash, or delete forever to remove both the database record and the stored file. Emptying the trash is permanent.",
  },
  {
    question: "Can I use my own Supabase project?",
    answer:
      "Yes. Apply the SQL migration, set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY and DATABASE_URL, then restart. Auth, private storage and the shared Postgres schema switch over together.",
  },
  {
    question: "Is the prompt assistant an LLM?",
    answer:
      "When a text provider is connected, yes. Otherwise the assistant uses a clearly labelled local rewrite engine that improves structure and cinematic language without inventing provider calls.",
  },
];

export default async function HelpPage() {
  const catalog = getProviderCatalog(authMode());
  const textOnline = catalog.textAvailable;
  const configured = catalog.models.filter((model) => model.available).length;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Support"
        title="Help & field guide"
        description="Everything you need to move from a sentence to a finished sequence, plus honest notes on setup, privacy and credits."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings#providers">
              <Settings2 /> Provider setup
            </Link>
          </Button>
        }
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {GUIDES.map((guide) => (
          <Link key={guide.title} href={guide.href}>
            <Card className="group h-full p-4 transition-all hover:-translate-y-0.5 hover:border-primary/20">
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <guide.icon className="size-4" />
              </span>
              <p className="mt-3 text-xs font-semibold">{guide.title}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{guide.description}</p>
              <span className="mt-3 flex items-center gap-1 text-[10px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Open <ArrowRight className="size-3" />
              </span>
            </Card>
          </Link>
        ))}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">The studio in three regions</h2>
          </div>
          <div className="mt-4 space-y-3">
            {[
              {
                step: "01",
                title: "Navigate and start",
                body: "The left rail holds Home, Create, Projects, Media, Templates and account tools. Collapse it for a wider canvas, or use the mobile bottom bar.",
              },
              {
                step: "02",
                title: "Direct in the workspace",
                body: "Prompts, model controls, references and storyboard scenes live in the center. Autosave reports saved, saving and error states as you work.",
              },
              {
                step: "03",
                title: "Inspect on the right",
                body: "Select a scene, result or media item to open the contextual inspector. With nothing selected, the panel stays intentionally empty.",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-3 rounded-xl border border-border/70 bg-muted/20 p-3.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-semibold text-primary">
                  {item.step}
                </span>
                <div>
                  <p className="text-[11px] font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Command className="size-4 text-primary" />
              <h2 className="text-sm font-semibold tracking-tight">Keyboard</h2>
            </div>
            <Badge variant="outline" className="text-[8px]">
              Accessible by default
            </Badge>
          </div>
          <div className="mt-4 divide-y divide-border/60">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.label} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="text-[10px] text-muted-foreground">{shortcut.label}</span>
                <span className="flex gap-1">
                  {shortcut.keys.map((key) => (
                    <kbd
                      key={key}
                      className="rounded-md border border-border bg-muted/70 px-1.5 py-0.5 font-mono text-[9px] text-foreground shadow-sm"
                    >
                      {key}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-border/70 bg-muted/20 p-3">
            <MousePointerClick className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Drag files anywhere on My media to upload. Drag scenes in a storyboard by their grip handle to
              reorder the sequence.
            </p>
          </div>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Coins className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">Credits, plainly</h2>
          </div>
          <div className="mt-3 space-y-2">
            {catalog.models.map((model) => (
              <div key={model.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium">{model.label}</p>
                  <p className="text-[9px] text-muted-foreground">
                    {model.creditUnit === "second" ? "per second of video" : "per image output"}
                  </p>
                </div>
                <Badge variant={model.available ? "success" : "outline"} className="text-[8px]">
                  {formatCredits(model.creditCost)} credits
                </Badge>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            Estimates are shown before you generate. Reserved credits are visible on Usage until a job settles.
            A failed or cancelled job releases its reservation.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">Privacy & safety</h2>
          </div>
          <div className="mt-3 space-y-2.5">
            {[
              { icon: LockKeyhole, title: "Private by default", body: "Every project, scene and asset is filtered by owner. Media is served through authenticated routes or signed URLs." },
              { icon: KeyRound, title: "Secrets stay server-side", body: "Provider and Supabase secret keys are read only in server code. The browser receives availability flags, never keys." },
              { icon: BadgeCheck, title: "Honest states", body: "Setup-needed models are labelled instead of hidden. Sample projects and local prompt rewrites are clearly marked." },
            ].map((item) => (
              <div key={item.title} className="flex gap-2.5">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <item.icon className="size-3.5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-4">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <CircleHelp className="size-4 text-primary" />
              <h2 className="text-sm font-semibold tracking-tight">Common questions</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant={configured > 0 ? "success" : "warning"} className="text-[8px]">
                {configured > 0 ? `${configured} models online` : "Setup mode"}
              </Badge>
              <Badge variant={textOnline ? "success" : "outline"} className="text-[8px]">
                {textOnline ? "AI assistant online" : "Local assistant"}
              </Badge>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[11px] font-medium">
                  {faq.question}
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-3xl text-[10px] leading-relaxed text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-4 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-blue-500/[0.05] p-5 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wand2 className="size-4" />
          </span>
          <div>
            <p className="text-xs font-semibold">Still stuck? Start with a template.</p>
            <p className="mt-1 max-w-lg text-[10px] leading-relaxed text-muted-foreground">
              Templates include an editable brief and, for storyboards, a full scene plan. They are the fastest way to
              see how the studio fits together.
            </p>
          </div>
        </div>
        <Button asChild className="mt-4 sm:mt-0">
          <Link href="/templates">
            Browse templates <ArrowRight />
          </Link>
        </Button>
      </section>
    </div>
  );
}
