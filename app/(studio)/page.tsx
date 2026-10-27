import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Clapperboard,
  Coins,
  CreditCard,
  FolderKanban,
  ImageIcon,
  LayoutTemplate,
  Play,
  Plus,
  Settings2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listProjects } from "@/lib/data/projects";
import { listAssets } from "@/lib/data/assets";
import { getUsage } from "@/lib/data/credits";
import { getTemplates } from "@/lib/templates";
import { authMode } from "@/lib/auth";
import { getProviderCatalog } from "@/lib/providers/models";
import { ProjectCard } from "@/components/studio/project-card";
import { HomeComposer } from "@/components/home/home-composer";
import { FlowHero } from "@/components/home/flow-hero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssetPreview } from "@/components/media/asset-preview";
import { formatCredits, relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const PLAN_LABELS: Record<string, string> = {
  free: "Starter",
  spark: "Starter",
  creator: "Creator",
  studio: "Studio",
  production: "Production",
};

export default async function HomePage() {
  const user = await requireUser();
  const catalog = getProviderCatalog(authMode());
  const [projects, media, usage] = await Promise.all([
    listProjects(user.id, { page: 1, pageSize: 7, search: "" }),
    listAssets(user.id, { page: 1, pageSize: 10, search: "", sort: "newest" }),
    getUsage(user.id),
  ]);

  const availableModels = catalog.models.filter((model) => model.available);
  const hasModels = availableModels.length > 0;
  const templates = getTemplates();
  const firstName = user.fullName.split(/\s+/)[0] || "Director";
  const featuredTemplates = templates.filter((template) => template.featured).slice(0, 3);
  const available = user.credits - user.reservedCredits;
  const planLabel = PLAN_LABELS[user.plan] ?? user.plan;
  const recentJobs = usage.jobs.slice(0, 3);

  const stats = [
    {
      label: "Credits available",
      value: formatCredits(available),
      hint: usage.reserved > 0 ? `${formatCredits(usage.reserved)} reserved` : `${planLabel} plan`,
      icon: Coins,
      href: "/usage",
    },
    {
      label: "Projects",
      value: String(projects.total),
      hint: "All time",
      icon: FolderKanban,
      href: "/projects",
    },
    {
      label: "Generations",
      value: String(usage.generationsThisMonth),
      hint: "This month",
      icon: TrendingUp,
      href: "/usage",
    },
    {
      label: "Media library",
      value: String(media.total),
      hint: "Images & clips",
      icon: ImageIcon,
      href: "/media",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1560px] px-3 py-4 sm:px-5 lg:px-8 lg:py-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {greeting()}, {firstName}.
          </span>{" "}
          What are we making today?
        </p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full ${hasModels ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            {hasModels ? `${availableModels.length} models online` : "Setup mode"}
          </span>
          <span className="size-0.5 rounded-full bg-border" />
          <span>{user.authMode === "local" ? "Local workspace" : "Cloud workspace"}</span>
        </div>
      </div>

      <FlowHero />

      <section className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card/45 px-3.5 py-3 transition-colors hover:border-foreground/15 hover:bg-card/80"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/80 text-muted-foreground transition-colors group-hover:text-foreground">
              <stat.icon className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold leading-none tracking-[-0.03em]">{stat.value}</p>
              <p className="mt-1 truncate text-[9px] text-muted-foreground">
                {stat.label} <span className="hidden text-muted-foreground/60 sm:inline">· {stat.hint}</span>
              </p>
            </div>
          </Link>
        ))}
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.03em]">Start with an idea</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                A sentence becomes a shot, a sequence or a whole world.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/create">
                Open studio <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <HomeComposer hasModels={hasModels} />
        </div>

        <div className="space-y-3">
          <Card className="relative overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-[radial-gradient(circle,rgba(138,180,248,0.16),transparent_65%)]" />
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Your plan
              </span>
              <Badge variant="outline" className="text-[8px] uppercase tracking-wider">
                {planLabel}
              </Badge>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold tracking-[-0.05em]">{formatCredits(available)}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">credits available</p>
              </div>
              <Link
                href="/pricing"
                className="flex h-8 items-center gap-1 rounded-full border border-border/70 px-3 text-[10px] font-semibold transition-colors hover:bg-muted"
              >
                <CreditCard className="size-3" /> {planLabel === "Starter" ? "Upgrade" : "Manage"}
              </Link>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-[width] duration-500"
                style={{ width: `${Math.max(3, Math.min(100, (available / 8000) * 100))}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground">
              <span>{formatCredits(usage.spentThisMonth)} spent this month</span>
              <Link href="/usage" className="hover:text-foreground">
                View ledger
              </Link>
            </div>
          </Card>

          {hasModels ? (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Studio pulse
                </p>
                <Link href="/usage" className="text-muted-foreground hover:text-foreground" aria-label="View usage">
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
              <div className="mt-3 space-y-3">
                {recentJobs.length > 0 ? (
                  recentJobs.map((job) => (
                    <div key={job.id} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        {job.kind === "video" ? <Play className="size-3" /> : <ImageIcon className="size-3" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium">{job.prompt}</p>
                        <p suppressHydrationWarning className="mt-0.5 text-[9px] capitalize text-muted-foreground">
                          {job.status} · {relativeTime(job.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-center">
                    <Clapperboard className="mx-auto size-4 text-muted-foreground" />
                    <p className="mt-2 text-[11px] font-medium">No generations yet</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Your first frame is one prompt away.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="border-amber-500/20 p-5">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300">
                  <Settings2 className="size-3.5" />
                </span>
                <p className="text-xs font-semibold">Generation is in setup mode</p>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                Browse, build storyboards and upload references now. Add a provider key on the
                server to turn on real generation.
              </p>
              <div className="mt-3 space-y-1.5">
                {catalog.setups.map((setup) => (
                  <div key={setup.provider} className="flex items-center justify-between text-[9px]">
                    <span className="text-muted-foreground">{setup.label}</span>
                    <Badge variant={setup.configured ? "success" : "outline"} className="text-[8px]">
                      {setup.configured ? "Connected" : "Key needed"}
                    </Badge>
                  </div>
                ))}
              </div>
              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link href="/settings#providers">
                  Open setup guide <ArrowRight />
                </Link>
              </Button>
            </Card>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4 px-1">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.03em]">Your projects</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Pick up a story, refine a scene, or begin something new.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/projects">
              All projects <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {projects.items.slice(0, 5).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          <Link
            href="/create"
            className="group flex min-h-[240px] flex-col items-center justify-center rounded-[1.7rem] border border-dashed border-border/80 bg-card/25 p-5 text-center transition-colors hover:border-foreground/25 hover:bg-card/60"
          >
            <span className="flex size-12 items-center justify-center rounded-full border border-border/70 bg-card/70 text-muted-foreground transition-colors group-hover:border-foreground/20 group-hover:text-foreground">
              <Plus className="size-5" />
            </span>
            <span className="mt-4 text-sm font-semibold">New project</span>
            <span className="mt-1 text-[10px] text-muted-foreground">Video, image or storyboard</span>
          </Link>
        </div>
        {projects.items.length === 0 ? (
          <Card className="mt-3 flex flex-col items-center justify-center py-12 text-center">
            <FolderKanban className="size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No projects yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Start with an idea in the composer above.</p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/create">
                <Plus /> Create your first project
              </Link>
            </Button>
          </Card>
        ) : null}
      </section>

      <section className="mt-10 grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="flex items-end justify-between gap-4 px-1">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.03em]">Recent media</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Your latest frames, clips and uploads.</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/media">
                Library <ArrowRight />
              </Link>
            </Button>
          </div>
          {media.items.length > 0 ? (
            <div className="scrollbar-none mt-3 flex gap-2.5 overflow-x-auto pb-1">
              {media.items.slice(0, 8).map((asset) => (
                <Link
                  key={asset.id}
                  href="/media"
                  className="group relative aspect-[4/3] w-[170px] shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-muted sm:w-[210px]"
                >
                  <AssetPreview asset={asset} />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80 transition-opacity group-hover:opacity-100" />
                  <span className="absolute bottom-2.5 left-3 right-3 truncate text-[10px] font-medium text-white/90">
                    {asset.title}
                  </span>
                  {asset.kind === "video" ? (
                    <span className="absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur">
                      <Play className="ml-0.5 size-2.5 fill-current" />
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : (
            <Card className="mt-3 flex flex-col items-center justify-center py-10 text-center">
              <ImageIcon className="size-5 text-muted-foreground" />
              <p className="mt-2 text-xs font-semibold">No media yet</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Upload references or generate your first frame.</p>
            </Card>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-end justify-between gap-4 px-1">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.03em]">Featured templates</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Curated starting points with editable prompts.</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/templates">
                All <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {featuredTemplates.map((template) => (
              <Link
                key={template.slug}
                href={`/templates?template=${template.slug}`}
                className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-border/60 bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={template.poster}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <Badge
                  variant="secondary"
                  className="absolute left-2.5 top-2.5 border border-white/10 bg-black/35 text-[8px] text-white backdrop-blur"
                >
                  {template.category}
                </Badge>
                <span className="absolute bottom-2.5 left-2.5 right-2.5 text-[11px] font-semibold leading-snug text-white">
                  {template.title}
                </span>
              </Link>
            ))}
          </div>
          <Card className="mt-2.5 flex items-center gap-3 rounded-2xl p-3.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <LayoutTemplate className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold">Build scene by scene</p>
              <p className="text-[10px] text-muted-foreground">Reorder, duplicate and generate storyboard frames.</p>
            </div>
            <Button asChild variant="ghost" size="icon-sm" aria-label="Open storyboard templates">
              <Link href="/templates?mode=storyboard">
                <ArrowRight />
              </Link>
            </Button>
          </Card>
        </div>
      </section>

      <section className="mt-10 overflow-hidden rounded-[1.8rem] border border-border/60 bg-card/40 p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <Badge variant="outline" className="text-[8px] uppercase tracking-[0.18em]">
              <Sparkles className="size-2.5" /> {planLabel} plan
            </Badge>
            <h2 className="mt-2.5 text-2xl font-semibold tracking-[-0.04em]">
              More credits. More room to experiment.
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Plans include a monthly credit allowance for video, images and storyboards. Every
              generation shows its estimate before you commit.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/pricing">
                View plans <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/usage">Usage</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
