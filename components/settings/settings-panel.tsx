"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  CreditCard,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  ServerCog,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/session-provider";
import { useTheme, type Theme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api, errorMessage } from "@/lib/client-api";
import { planLabel } from "@/lib/billing/plans";
import { cn, formatDate } from "@/lib/utils";
import type { AppUser, ProviderCatalog } from "@/lib/types";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "providers", label: "Providers", icon: ServerCog },
  { id: "workspace", label: "Workspace", icon: Database },
] as const;

const THEMES: Array<{ value: Theme; label: string; description: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", description: "Bright surfaces, ink text", icon: Sun },
  { value: "dark", label: "Dark", description: "Charcoal studio mode", icon: Moon },
  { value: "system", label: "System", description: "Follow your device", icon: Monitor },
];

export function SettingsPanel({
  initialUser,
  catalog,
  storage,
}: {
  initialUser: AppUser;
  catalog: ProviderCatalog;
  storage: "local" | "supabase";
}) {
  const { user, updateUser } = useSession();
  const { theme, setTheme } = useTheme();
  const [fullName, setFullName] = React.useState(initialUser.fullName);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [savingPassword, setSavingPassword] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);

  const isSupabase = user.authMode === "supabase";

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    const name = fullName.trim();
    if (name.length < 2) {
      toast.error("Enter your name.");
      return;
    }
    setSavingProfile(true);
    try {
      const result = await api<{ user: AppUser }>("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ fullName: name }),
      });
      updateUser(result.user);
      toast.success("Profile updated.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!isSupabase && !currentPassword) {
      toast.error("Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed. Other sessions may need to sign in again.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingPassword(false);
    }
  }

  async function copyValue(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.error("Could not access the clipboard.");
    }
  }

  const envSnippet = [
    "GEMINI_API_KEY=your_google_ai_studio_key",
    "OPENAI_API_KEY=your_openai_key",
    "JSON2VIDEO_API_KEY=your_json2video_key",
  ].join("\n");

  return (
    <div className="grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-20 lg:h-fit">
        <nav className="flex max-w-full flex-wrap gap-1 rounded-xl border border-border/70 bg-card/50 p-1.5 lg:flex-col">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <section.icon className="size-3.5" /> {section.label}
            </a>
          ))}
        </nav>
        <div className="mt-3 hidden rounded-xl border border-border/70 bg-card/40 p-3 lg:block">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Workspace mode
          </p>
          <p className="mt-1.5 text-[11px] font-medium capitalize">{user.authMode} auth</p>
          <p className="text-[10px] capitalize text-muted-foreground">{storage} storage</p>
          <Badge variant={user.authMode === "supabase" ? "success" : "outline"} className="mt-2 text-[8px]">
            {user.authMode === "supabase" ? "Cloud" : "Local-first"}
          </Badge>
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <Card id="profile" className="scroll-mt-20 p-5">
          <SectionHeading
            icon={UserRound}
            title="Profile"
            description="How your name appears across the studio."
          />
          <form onSubmit={saveProfile} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="settings-name">Full name</Label>
                <Input
                  id="settings-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  maxLength={80}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-email">Email</Label>
                <Input id="settings-email" value={user.email} readOnly disabled className="opacity-70" />
                <p className="text-[10px] text-muted-foreground">
                  Email changes are managed by your {isSupabase ? "Supabase" : "local"} auth provider.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={savingProfile} disabled={fullName.trim() === user.fullName}>
                Save profile
              </Button>
            </div>
          </form>
        </Card>

        <Card id="security" className="scroll-mt-20 p-5">
          <SectionHeading
            icon={KeyRound}
            title="Password"
            description={
              isSupabase
                ? "Update the password for your Supabase account."
                : "Passwords are hashed with scrypt and never stored in plain text."
            }
          />
          <form onSubmit={savePassword} className="mt-5 space-y-4">
            {!isSupabase ? (
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type={showPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              At least 8 characters with a letter and a number.
            </p>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                loading={savingPassword}
                disabled={!newPassword || !confirmPassword}
              >
                Change password
              </Button>
            </div>
          </form>
        </Card>

        <Card id="appearance" className="scroll-mt-20 p-5">
          <SectionHeading
            icon={Palette}
            title="Appearance"
            description="The studio opens in dark cinematic mode. Light is a clean paper alternative."
          />
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {THEMES.map((option) => {
              const active = theme === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                    active
                      ? "border-primary/30 bg-primary/[0.06] ring-1 ring-primary/15"
                      : "border-border/70 bg-card/50 hover:border-primary/20",
                  )}
                  aria-pressed={active}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <option.icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold">{option.label}</span>
                    <span className="block truncate text-[9px] text-muted-foreground">{option.description}</span>
                  </span>
                  {active ? <Check className="ml-auto size-3.5 shrink-0 text-primary" /> : null}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">
            Reduced-motion preferences are respected automatically. Focus rings and keyboard navigation are
            enabled throughout.
          </p>
        </Card>

        <Card id="providers" className="scroll-mt-20 p-5">
          <SectionHeading
            icon={ServerCog}
            title="AI providers"
            description="Keys live on the server only. The browser never receives provider secrets."
          />
          <div className="mt-5 space-y-2.5">
            {catalog.setups.map((setup) => (
              <div
                key={setup.provider}
                className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:flex-row sm:items-center"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    setup.configured ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "bg-muted text-muted-foreground",
                  )}
                >
                  {setup.configured ? <Check className="size-4" /> : <KeyRound className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-xs font-semibold">{setup.label}</p>
                    <Badge variant={setup.configured ? "success" : "outline"} className="text-[8px]">
                      {setup.configured ? "Connected" : "Setup needed"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{setup.note}</p>
                  <p className="mt-1 font-mono text-[9px] text-muted-foreground">{setup.envVariables.join(" · ")}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-border/70 bg-[#0d0d14] p-3.5 text-[#d8d8e6]">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">.env.local</p>
              <button
                onClick={() => void copyValue(envSnippet, "env")}
                className="flex items-center gap-1 text-[9px] text-white/50 transition-colors hover:text-white"
              >
                {copied === "env" ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied === "env" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="mt-2 overflow-x-auto font-mono text-[10px] leading-relaxed">
              <code>{envSnippet}</code>
            </pre>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            Add keys to <code className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">.env.local</code>, restart the
            dev server, then refresh this page. Generation stays in setup mode until at least one key is present.
          </p>
        </Card>

        <Card id="workspace" className="scroll-mt-20 p-5">
          <SectionHeading
            icon={Database}
            title="Workspace"
            description="Where your data lives in this environment."
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoTile label="Authentication" value={isSupabase ? "Supabase Auth" : "Local accounts"} hint={isSupabase ? "SSR sessions + RLS" : "scrypt + signed cookies"} />
            <InfoTile label="Database" value={isSupabase ? "Supabase PostgreSQL" : "Embedded PGlite"} hint={isSupabase ? "DATABASE_URL" : ".data/whisk-flow-db"} />
            <InfoTile label="Media storage" value={storage === "supabase" ? "Supabase Storage" : "Local private files"} hint={storage === "supabase" ? "Private bucket + signed reads" : ".data/uploads"} />
            <InfoTile label="Credits" value={`${user.credits - user.reservedCredits} available`} hint="Server-authoritative ledger" />
          </div>
          <Separator className="my-4" />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[9px]">
              Plan · {planLabel(user.plan)}
            </Badge>
            <Badge variant="outline" className="text-[9px]" suppressHydrationWarning>
              Joined {formatDate(user.createdAt, { day: undefined, month: "short", year: "numeric" })}
            </Badge>
            <Badge variant="outline" className="text-[9px]">
              {user.authMode === "local" ? "Local mode" : "Cloud mode"}
            </Badge>
            <Button asChild variant="outline" size="sm" className="ml-auto">
              <Link href="/pricing">
                <CreditCard /> Plans & credits
              </Link>
            </Button>
          </div>
          {user.authMode === "local" ? (
            <div className="mt-4 rounded-xl border border-border/70 bg-muted/25 p-3">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                This workspace runs locally without external credentials. Projects, scenes, media and credits
                persist under <code className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">.data/</code>. Add
                Supabase and provider keys to move to a shared cloud deployment.
              </p>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function InfoTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
      <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-[11px] font-semibold">{value}</p>
      <p className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground">{hint}</p>
    </div>
  );
}
