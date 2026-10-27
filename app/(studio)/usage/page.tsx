import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Coins,
  CreditCard,
  Gauge,
  ImageIcon,
  ReceiptText,
  Settings2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Video,
} from "lucide-react";
import { authMode, requireUser } from "@/lib/auth";
import { getUsage } from "@/lib/data/credits";
import { getProviderCatalog } from "@/lib/providers/models";
import { PageHeader } from "@/components/studio/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCredits, relativeTime } from "@/lib/utils";
import type { CreditTransaction, GenerationJob } from "@/lib/types";

export const metadata: Metadata = { title: "Usage" };
export const dynamic = "force-dynamic";

const TRANSACTION_LABELS: Record<CreditTransaction["type"], string> = {
  grant: "Grant",
  reservation: "Reservation",
  charge: "Charge",
  release: "Release",
  adjustment: "Adjustment",
};

const JOB_VARIANTS: Record<GenerationJob["status"], "success" | "warning" | "danger" | "secondary" | "default"> = {
  succeeded: "success",
  running: "default",
  queued: "warning",
  failed: "danger",
  cancelled: "secondary",
};

export default async function UsagePage() {
  const user = await requireUser();
  const [usage, catalog] = await Promise.all([
    getUsage(user.id),
    Promise.resolve(getProviderCatalog(authMode())),
  ]);
  const available = usage.balance - usage.reserved;
  const usedPercent = usage.balance > 0 ? Math.min(100, Math.round((usage.spentThisMonth / usage.balance) * 100)) : 0;

  const summary = [
    {
      label: "Available credits",
      value: formatCredits(available),
      hint: usage.reserved > 0 ? `${formatCredits(usage.reserved)} reserved` : "Ready to spend",
      icon: Coins,
    },
    {
      label: "Spent this month",
      value: formatCredits(usage.spentThisMonth),
      hint: `${usage.generationsThisMonth} generations`,
      icon: TrendingDown,
    },
    {
      label: "Granted this month",
      value: formatCredits(usage.grantedThisMonth),
      hint: "Plan and pack grants",
      icon: TrendingUp,
    },
    {
      label: "Total balance",
      value: formatCredits(usage.balance),
      hint: `${usedPercent}% of balance used this month`,
      icon: Gauge,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Account"
        title="Usage"
        description="Server-authoritative credit balance, reservations and a complete generation ledger. Credits are Whisk Flow units, not provider currency."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/settings#providers">
                <Settings2 /> Provider setup
              </Link>
            </Button>
            <Button asChild>
              <Link href="/pricing">
                <CreditCard /> Plans & credits
              </Link>
            </Button>
          </div>
        }
      />

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="flex size-7 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
                <item.icon className="size-3.5" />
              </span>
            </div>
            <p className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{item.value}</p>
            <p className="text-[10px] font-medium text-muted-foreground">{item.label}</p>
            <p className="mt-0.5 text-[9px] text-muted-foreground/70">{item.hint}</p>
          </Card>
        ))}
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Monthly flow
            </p>
            <Badge variant="outline" className="text-[9px]">
              {usage.byKind.length > 0 ? `${usage.byKind.reduce((sum, item) => sum + item.count, 0)} jobs` : "No jobs yet"}
            </Badge>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-semibold tracking-tight">{formatCredits(available)}</p>
              <p className="text-[10px] text-muted-foreground">available now</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{formatCredits(usage.reserved)}</p>
              <p className="text-[10px] text-muted-foreground">reserved</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full accent-gradient" style={{ width: `${Math.max(2, 100 - usedPercent)}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground">
            <span>{usedPercent}% used this month</span>
            <span>{formatCredits(usage.balance)} total</span>
          </div>

          <div className="mt-5 space-y-2">
            {usage.byKind.length > 0 ? (
              usage.byKind.map((item) => (
                <div key={item.kind} className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/25 px-3 py-2">
                  <span className="flex items-center gap-2 text-[11px] font-medium capitalize">
                    {item.kind === "video" ? <Video className="size-3.5 text-primary" /> : <ImageIcon className="size-3.5 text-primary" />}
                    {item.kind}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {item.count} {item.count === 1 ? "job" : "jobs"} · {formatCredits(item.credits)} credits
                  </span>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-[10px] text-muted-foreground">
                Generate an image or clip to see usage by type.
              </p>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <ReceiptText className="size-3.5 text-primary" />
              <p className="text-xs font-semibold">Credit ledger</p>
            </div>
            <span className="text-[9px] text-muted-foreground">Latest 60 entries</span>
          </div>
          {usage.transactions.length > 0 ? (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-left text-[10px]">
                <thead className="sticky top-0 z-10 bg-card/95 text-[9px] uppercase tracking-wider text-muted-foreground backdrop-blur">
                  <tr className="border-b border-border/70">
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-4 py-2 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-2.5">
                        <Badge
                          variant={
                            transaction.type === "charge"
                              ? "warning"
                              : transaction.type === "grant"
                                ? "success"
                                : transaction.type === "reservation"
                                  ? "default"
                                  : "secondary"
                          }
                          className="text-[8px]"
                        >
                          {TRANSACTION_LABELS[transaction.type]}
                        </Badge>
                      </td>
                      <td className="max-w-[220px] px-3 py-2.5">
                        <p className="truncate font-medium">{transaction.description}</p>
                        <p suppressHydrationWarning className="mt-0.5 text-[9px] text-muted-foreground">
                          {relativeTime(transaction.createdAt)}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                        {transaction.type === "reservation" ? (
                          <span className="text-muted-foreground">held {transaction.reservedDelta}</span>
                        ) : transaction.amount === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={transaction.amount > 0 ? "text-emerald-600 dark:text-emerald-300" : "text-foreground"}>
                            {transaction.amount > 0 ? "+" : ""}
                            {formatCredits(transaction.amount)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatCredits(transaction.balanceAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-10 text-center">
              <ReceiptText className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-2 text-xs font-semibold">No ledger entries yet</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Grants and generation charges appear here.</p>
            </div>
          )}
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary" />
              <p className="text-xs font-semibold">Recent generations</p>
            </div>
            <span className="text-[9px] text-muted-foreground">Latest 30</span>
          </div>
          {usage.jobs.length > 0 ? (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-left text-[10px]">
                <thead className="sticky top-0 z-10 bg-card/95 text-[9px] uppercase tracking-wider text-muted-foreground backdrop-blur">
                  <tr className="border-b border-border/70">
                    <th className="px-4 py-2 font-medium">Generation</th>
                    <th className="px-3 py-2 font-medium">Model</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.jobs.map((job) => (
                    <tr key={job.id} className="border-b border-border/40 last:border-0">
                      <td className="max-w-[260px] px-4 py-2.5">
                        <p className="truncate font-medium">{job.prompt}</p>
                        <p suppressHydrationWarning className="mt-0.5 text-[9px] text-muted-foreground">
                          {relativeTime(job.createdAt)} · {job.outputCount} {job.outputCount === 1 ? "output" : "outputs"}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="truncate">{job.model}</p>
                        <p className="text-[9px] capitalize text-muted-foreground">{job.provider}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={JOB_VARIANTS[job.status]} className="text-[8px] capitalize">
                          {job.status}
                        </Badge>
                        {job.error ? <p className="mt-1 max-w-[140px] truncate text-[9px] text-destructive">{job.error}</p> : null}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatCredits(job.creditsReserved)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-10 text-center">
              <Sparkles className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-2 text-xs font-semibold">No generations yet</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Start in Create to see job history here.</p>
              <Button asChild size="sm" className="mt-3">
                <Link href="/create">
                  Open studio <ArrowRight />
                </Link>
              </Button>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-semibold">Credit estimates</p>
            <p className="mt-0.5 text-[9px] text-muted-foreground">
              App credits per output. Final cost is captured after a successful generation.
            </p>
          </div>
          <div className="divide-y divide-border/60">
            {catalog.models.map((model) => (
              <div key={model.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium">{model.label}</p>
                  <p className="text-[9px] capitalize text-muted-foreground">
                    {model.providerLabel} · {model.kind} · {model.creditUnit === "second" ? "per second" : "per image"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold tabular-nums">
                    {formatCredits(model.creditUnit === "second" ? model.creditCost * (model.durations[0] ?? 10) : model.creditCost)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {model.creditUnit === "second" ? `per ${model.durations[0] ?? 10}s clip` : "per output"}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border bg-muted/20 px-4 py-3">
            <p className="text-[9px] leading-relaxed text-muted-foreground">
              Credits are reserved before a job starts, captured on success, and released if a job fails or
              is cancelled. Ledger entries are written server-side.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}
