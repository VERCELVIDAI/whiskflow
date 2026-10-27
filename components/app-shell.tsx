"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CircleHelp,
  Clapperboard,
  CreditCard,
  FolderKanban,
  Gauge,
  Heart,
  Home,
  ImagePlus,
  Images,
  LayoutTemplate,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { cn, formatCredits } from "@/lib/utils";
import { useSession } from "@/components/session-provider";
import { Wordmark, LogoMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
}

const WORKSPACE_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/create", label: "Create", icon: Sparkles },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/media", label: "My media", icon: Images },
];

const LIBRARY_NAV: NavItem[] = [
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/trash", label: "Trash", icon: Trash2 },
];

const ACCOUNT_NAV: NavItem[] = [
  { href: "/pricing", label: "Plans", icon: CreditCard },
  { href: "/usage", label: "Usage", icon: Gauge },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help", icon: CircleHelp },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  "/create": "Create",
  "/projects": "Projects",
  "/media": "My media",
  "/templates": "Templates",
  "/favorites": "Favorites",
  "/trash": "Trash",
  "/pricing": "Plans",
  "/usage": "Usage",
  "/settings": "Settings",
  "/help": "Help",
};

const QUICK_ACTIONS = [
  { href: "/create?mode=video", label: "New video", icon: Clapperboard },
  { href: "/create?mode=image", label: "New image", icon: ImagePlus },
  { href: "/create?mode=storyboard", label: "New storyboard", icon: LayoutTemplate },
];

const PLAN_LABELS: Record<string, string> = {
  free: "Starter",
  spark: "Starter",
  creator: "Creator",
  studio: "Studio",
  production: "Production",
};

function isPaidPlan(plan: string): boolean {
  return !["free", "spark"].includes(plan);
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-full px-3.5 py-2.5 text-[13px] font-medium transition-all",
        collapsed ? "justify-center px-0" : "",
        active
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      <item.icon className={cn("size-[17px] shrink-0", active ? "" : "opacity-80")} />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
      {!collapsed && item.href === "/pricing" ? (
        <span
          className={cn(
            "ml-auto rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider",
            active ? "bg-background/15 text-background" : "bg-foreground/10 text-foreground",
          )}
        >
          New
        </span>
      ) : null}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function SidebarContent({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { user } = useSession();
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const available = user.credits - user.reservedCredits;
  const planLabel = PLAN_LABELS[user.plan] ?? user.plan;

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-[72px] items-center px-5", collapsed ? "justify-center px-0" : "")}>
        {collapsed ? (
          <LogoMark className="size-8" />
        ) : (
          <div className="flex w-full items-center justify-between">
            <Wordmark markClassName="size-8" showTagline />
            <span className="rounded-full border border-border/70 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Beta
            </span>
          </div>
        )}
      </div>

      <div className={cn("px-3 pb-3", collapsed && "px-2")}>
        <Button
          asChild
          size={collapsed ? "icon" : "default"}
          className={cn("w-full", collapsed && "mx-auto")}
        >
          <Link href="/create" onClick={onNavigate} aria-label="Create new">
            <Plus />
            {!collapsed ? "Create new" : null}
          </Link>
        </Button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-3" aria-label="Primary">
        <div className="space-y-1">
          {!collapsed ? (
            <p className="px-3.5 pb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
              Studio
            </p>
          ) : null}
          {WORKSPACE_NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item)}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
        <div className="space-y-1">
          {!collapsed ? (
            <p className="px-3.5 pb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
              Library
            </p>
          ) : null}
          {LIBRARY_NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item)}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
        <div className="space-y-1">
          {!collapsed ? (
            <p className="px-3.5 pb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
              Account
            </p>
          ) : null}
          {ACCOUNT_NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item)}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </nav>

      <div className={cn("space-y-3 p-3", collapsed && "px-2")}>
        {!collapsed ? (
          <div className="rounded-[1.4rem] border border-border/70 bg-card/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {planLabel} plan
              </span>
              <Sparkles className="size-3.5 text-muted-foreground" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-[22px] font-semibold tracking-[-0.04em]">{formatCredits(available)}</span>
              <span className="text-[10px] text-muted-foreground">credits</span>
            </div>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-[width] duration-500"
                style={{ width: `${Math.max(3, Math.min(100, (available / 8000) * 100))}%` }}
              />
            </div>
            <Link
              href="/pricing"
              onClick={onNavigate}
              className="mt-3 flex h-8 items-center justify-center gap-1.5 rounded-full border border-border/80 text-[10px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Get more credits <ArrowUpRight className="size-3" />
            </Link>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/pricing"
                className="flex flex-col items-center gap-0.5 rounded-2xl border border-border/70 bg-card p-2 text-center"
                aria-label={`${formatCredits(available)} credits available. View plans.`}
              >
                <span className="text-[11px] font-semibold">{formatCredits(available)}</span>
                <span className="text-[8px] uppercase tracking-wider text-muted-foreground">credits</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Credits · view plans</TooltipContent>
          </Tooltip>
        )}
        {!collapsed ? (
          <div className="flex items-center gap-2 rounded-2xl px-1 py-1">
            <UserMenu compact />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold">{user.fullName}</p>
              <p className="truncate text-[9px] text-muted-foreground">{planLabel} · {user.email}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { catalog } = useSession();
  const [query, setQuery] = React.useState("");
  const [projects, setProjects] = React.useState<Array<{ id: string; title: string; mode: string }>>([]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/projects?search=${encodeURIComponent(query)}&pageSize=5`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data?.items) setProjects(data.items);
        })
        .catch(() => undefined);
    }, 220);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, open]);

  const navItems = [...WORKSPACE_NAV, ...LIBRARY_NAV, ...ACCOUNT_NAV];
  const filteredNav = navItems.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const filteredActions = QUICK_ACTIONS.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={false} className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Search Whisk Flow</DialogTitle>
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, actions and projects…"
            className="h-12 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:bg-transparent focus-visible:ring-0"
            aria-label="Search"
          />
          <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
            ESC
          </kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {filteredActions.length > 0 ? (
            <div className="mb-2">
              <p className="px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Create
              </p>
              {filteredActions.map((item) => (
                <button
                  key={item.href}
                  onClick={() => go(item.href)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <item.icon className="size-4 text-muted-foreground" />
                  {item.label}
                  {!catalog.models.some((model) => model.available) ? (
                    <Badge variant="outline" className="ml-auto text-[9px]">
                      Setup needed
                    </Badge>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
          {filteredNav.length > 0 ? (
            <div className="mb-2">
              <p className="px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Go to
              </p>
              {filteredNav.map((item) => (
                <button
                  key={item.href}
                  onClick={() => go(item.href)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <item.icon className="size-4 text-muted-foreground" />
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          {projects.length > 0 ? (
            <div>
              <p className="px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Projects
              </p>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => go(`/projects/${project.id}`)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <FolderKanban className="size-4 text-muted-foreground" />
                  <span className="truncate">{project.title}</span>
                  <span className="ml-auto text-[10px] capitalize text-muted-foreground">{project.mode}</span>
                </button>
              ))}
            </div>
          ) : null}
          {filteredActions.length === 0 && filteredNav.length === 0 && projects.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Wand2 className="size-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No matches</p>
              <p className="text-xs text-muted-foreground">Try a page name, “video”, or a project title.</p>
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span>Navigate with your mouse or keyboard</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5">⌘</kbd>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5">K</kbd>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);

  React.useEffect(() => {
    setCollapsed(localStorage.getItem("whisk-sidebar-collapsed") === "1");
  }, []);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      localStorage.setItem("whisk-sidebar-collapsed", current ? "0" : "1");
      return !current;
    });
  }

  const title = PAGE_TITLES[pathname] ?? (pathname.startsWith("/projects/") ? "Project" : "Whisk Flow");
  const available = user.credits - user.reservedCredits;
  const planLabel = PLAN_LABELS[user.plan] ?? user.plan;
  const paid = isPaidPlan(user.plan);

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flow-shell min-h-dvh">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden border-r border-sidebar-border bg-sidebar backdrop-blur-2xl transition-[width] duration-300 lg:block",
            collapsed ? "w-[78px]" : "w-[252px]",
          )}
        >
          <SidebarContent collapsed={collapsed} />
          <button
            onClick={toggleCollapsed}
            className="absolute -right-3 top-[84px] flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="size-3" /> : <PanelLeftClose className="size-3" />}
          </button>
        </aside>

        <div
          className={cn(
            "flex min-h-dvh flex-col transition-[padding] duration-300",
            collapsed ? "lg:pl-[78px]" : "lg:pl-[252px]",
          )}
        >
          <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-border/60 bg-background/75 px-4 backdrop-blur-2xl lg:px-7">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </button>
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <LogoMark className="hidden size-7 min-[360px]:block" />
              <span className="truncate text-sm font-semibold">{title}</span>
            </div>
            <div className="hidden min-w-0 items-center gap-2.5 lg:flex">
              <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>
              <span className="hidden rounded-full border border-border/70 px-2 py-0.5 text-[9px] font-medium text-muted-foreground xl:inline">
                {planLabel}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => setCommandOpen(true)}
                className="hidden h-9 items-center gap-2 rounded-full border border-border/70 bg-card/50 px-3.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground sm:flex"
                aria-label="Search"
              >
                <Search className="size-3.5" />
                <span className="hidden md:inline">Search</span>
                <kbd className="ml-2 hidden items-center gap-0.5 rounded border border-border bg-muted px-1 py-0.5 text-[9px] md:flex">
                  ⌘K
                </kbd>
              </button>
              <Link
                href="/usage"
                className="hidden h-9 items-center gap-1.5 rounded-full border border-border/70 bg-card/50 px-3.5 text-xs font-medium transition-colors hover:border-foreground/20 sm:flex"
                aria-label={`${formatCredits(available)} credits available`}
              >
                <Sparkles className="size-3.5 text-muted-foreground" />
                <span>{formatCredits(available)}</span>
                <span className="hidden text-muted-foreground md:inline">credits</span>
              </Link>
              <Button asChild size="sm" className="hidden h-9 px-4 sm:inline-flex">
                <Link href="/pricing">{paid ? "Manage plan" : "Upgrade"}</Link>
              </Button>
              <ThemeToggle />
              {paid ? (
                <span className="hidden rounded-full border border-border/80 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-foreground sm:inline">
                  Pro
                </span>
              ) : null}
              <UserMenu compact />
            </div>
          </header>

          <main className="flex-1 pb-24 lg:pb-0">{children}</main>
        </div>

        {/* Mobile navigation */}
        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogContent showClose={false} className="left-0 top-0 h-dvh w-[288px] max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 p-0">
            <DialogTitle className="sr-only">Navigation</DialogTitle>
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-5 z-10 flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </button>
            <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </DialogContent>
        </Dialog>

        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border/70 bg-background/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-2xl lg:hidden"
          aria-label="Mobile"
        >
          {[
            { href: "/", label: "Home", icon: Home, exact: true },
            { href: "/projects", label: "Projects", icon: FolderKanban },
            { href: "/create", label: "Create", icon: Plus, primary: true },
            { href: "/media", label: "Media", icon: Images },
            { href: "/settings", label: "Settings", icon: Settings },
          ].map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            if (item.primary) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="-mt-5 flex size-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg shadow-black/25 ring-4 ring-background"
                  aria-label="Create"
                >
                  <Plus className="size-5" />
                </Link>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[9px] font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className={cn("size-[18px]", active && "stroke-[2.4]")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      </div>
    </TooltipProvider>
  );
}
